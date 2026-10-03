import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import redis from "../lib/redis.js";
import logger from "../config/logger.js";
import { generateAndStoreOtp, verifyOtp } from "../utils/otp.js";
import config from "../config/index.js";
import { sendOtpEmailEvent, sendWelcomeEmailEvent } from "../kafka/producer.js";
import {
    ConflictError,
    BadRequestError,
    UnauthorizedError,
    NotFoundError,
    TooManyRequestsError
} from "../utils/error.js";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} from "./token.service.js";
import {
    createSession,
    getSession,
    acquireRefreshLock,
    releaseRefreshLock,
    recordRevokedJti,
    isJtiRevokedInFamily,
    updateSessionJti,
    revokeSession,
    revokeFamily
} from "./session.service.js";

// Dummy bcrypt hash for constant-time comparison when email is not found
const DUMMY_HASH = "$2a$12$e8nO6Yc5Fj8xZ1pE2w3R4.T9yU0vI1oP2aS3dF4gH5jK6lM7nO8pQ";

// Redis cache prefix for safe user profile data
const USER_PROFILE_CACHE_PREFIX = "user:profile:";

/**
 * Retrieves cached user profile from Redis (Cache-Aside pattern)
 * Safe and fail-open: returns null on cache miss or Redis error
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const getCachedUserProfile = async (userId) => {
    if (!userId) return null;
    try {
        const cached = await redis.get(`${USER_PROFILE_CACHE_PREFIX}${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        logger.warn(`[Redis Cache] Error reading profile cache for ${userId}: ${err.message}`);
    }
    return null;
};

/**
 * Stores lightweight sanitized user profile in Redis with explicit TTL
 * Stores ONLY required attributes: id, email, firstName, lastName, emailVerified, createdAt, updatedAt
 * Never stores passwords or sensitive security secrets
 * @param {string} userId
 * @param {object} user
 */
const setCachedUserProfile = async (userId, user) => {
    if (!userId || !user) return;
    try {
        const safeUser = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: Boolean(user.emailVerified),
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        await redis.set(
            `${USER_PROFILE_CACHE_PREFIX}${userId}`,
            JSON.stringify(safeUser),
            "EX",
            config.USER_CACHE_TTL || 900
        );
    } catch (err) {
        logger.warn(`[Redis Cache] Error caching profile for ${userId}: ${err.message}`);
    }
};

/**
 * Evicts user profile from Redis cache on state mutation or logout
 * @param {string} userId
 */
const invalidateUserProfileCache = async (userId) => {
    if (!userId) return;
    try {
        await redis.del(`${USER_PROFILE_CACHE_PREFIX}${userId}`);
    } catch (err) {
        logger.warn(`[Redis Cache] Error invalidating profile cache for ${userId}: ${err.message}`);
    }
};

/**
 * Initiates user registration by validating uniqueness, generating OTP, and emailing verification code
 */
const sendOTP = async (firstName, lastName, email, password, confirmPass) => {
    if (!firstName || !lastName || !email || !password || !confirmPass) {
        throw new BadRequestError("All fields are mandatory");
    }

    if (password !== confirmPass) {
        throw new BadRequestError("Password and confirm password must match");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: {
            email: normalizedEmail
        }
    });

    if (existingUser) {
        throw new ConflictError("An account with this email address already exists");
    }

    // Securely hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const meta = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        hashedPassword
    };

    // Generate secure OTP & store in Redis session
    const { otp, otpSessionId } = await generateAndStoreOtp(normalizedEmail, meta);

    // Asynchronously dispatch OTP event to Kafka broker
    await sendOtpEmailEvent({
        email: normalizedEmail,
        firstName: firstName.trim(),
        otp,
        ttl: config.OTP_TTL || 300
    });

    return {
        otpSessionId,
        otpSessionID: otpSessionId // backwards-compatibility
    };
};

/**
 * Verifies OTP session and persists newly registered user to the database
 */
const verifyOTPAndRegister = async (otpSessionId, otp) => {
    if (!otpSessionId || !otp) {
        throw new BadRequestError("OTP session ID and verification code are required");
    }

    // 1. Verify OTP against Redis session
    const { email, meta } = await verifyOtp(otpSessionId, otp.trim());

    // 2. Ensure user doesn't already exist in DB
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existingUser) {
        throw new ConflictError("User with this email is already registered");
    }

    // 3. Create verified user record in Prisma DB
    const newUser = await prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email,
            password: meta.hashedPassword,
            emailVerified: true
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });

    // Asynchronously dispatch Welcome email event to Kafka broker
    await sendWelcomeEmailEvent({
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
    });

    // Prime the lightweight user profile cache in Redis
    await setCachedUserProfile(newUser.id, newUser);

    return { user: newUser };
};

/**
 * Authenticates a user with email and password, creates a Redis session, and issues tokens
 * @param {string} email
 * @param {string} password
 * @param {object} metadata - Optional userAgent and ipAddress
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
const loginUser = async (email, password, { userAgent = "", ipAddress = "" } = {}) => {
    if (!email || !password) {
        throw new BadRequestError("Email and password are required");
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // 1. Find user in database
    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail
        }
    });

    // 2. Timing attack mitigation: run dummy compare if user does not exist or has no password
    if (!user || !user.password) {
        await bcrypt.compare(password, DUMMY_HASH);
        throw new UnauthorizedError("Invalid email or password.");
    }

    // 3. Verify password hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new UnauthorizedError("Invalid email or password.");
    }

    // 4. Generate identifiers for session and token family
    const sessionId = crypto.randomUUID();
    const tokenFamilyId = crypto.randomUUID();

    // 5. Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, jti } = generateRefreshToken({
        userId: user.id,
        sessionId,
        tokenFamilyId
    });

    // 6. Store session with active JTI in Redis
    await createSession({
        sessionId,
        userId: user.id,
        tokenFamilyId,
        jti,
        userAgent,
        ipAddress
    });

    // Warm the user profile cache in Redis (15-minute TTL)
    await setCachedUserProfile(user.id, user);

    logger.info(`[Auth] User logged in successfully: ${user.id}`);

    return {
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerified
        },
        accessToken,
        refreshToken
    };
};

/**
 * Validates the refresh token, performs reuse detection, and rotates tokens atomically
 * @param {string} rawRefreshToken
 * @param {object} metadata - Optional userAgent and ipAddress
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
const refreshUserSession = async (rawRefreshToken, { userAgent = "", ipAddress = "" } = {}) => {
    if (!rawRefreshToken) {
        throw new UnauthorizedError("Refresh token is required");
    }

    // 1. Verify JWT signature, expiration, and claims
    let decoded;
    try {
        decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
        throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const { sid: sessionId, fid: tokenFamilyId, sub: userId, jti } = decoded;

    if (!sessionId || !tokenFamilyId || !userId || !jti) {
        throw new UnauthorizedError("Invalid refresh token payload");
    }

    // 2. Acquire atomic Redis lock to prevent concurrent refresh race conditions
    const lockAcquired = await acquireRefreshLock(sessionId, 4000);
    if (!lockAcquired) {
        throw new TooManyRequestsError("Token refresh in progress. Please retry momentarily.");
    }

    try {
        // 3. Fetch active session from Redis
        const session = await getSession(sessionId);

        // Check if session exists or was revoked
        if (!session || session.revoked) {
            throw new UnauthorizedError("Session has expired or been revoked. Please log in again.");
        }

        // 4. Verify presenting active token JTI
        if (session.jti === jti) {
            // Valid active token: Rotate token
            // Invalidate current token by recording in family's revoked JTI history
            await recordRevokedJti(session.tokenFamilyId, jti);

            // Fetch current user details (using cache-aside to avoid database load during token rotation)
            let user;
            try {
                user = await getUserProfile(session.userId);
            } catch (err) {
                if (err instanceof NotFoundError) {
                    await revokeSession(sessionId);
                    throw new UnauthorizedError("User account no longer exists");
                }
                throw err;
            }

            // Generate new access and refresh tokens
            const newAccessToken = generateAccessToken(user);
            const { token: newRefreshToken, jti: newJti } = generateRefreshToken({
                userId: user.id,
                sessionId,
                tokenFamilyId: session.tokenFamilyId
            });

            // Update session in Redis with new active JTI
            await updateSessionJti(sessionId, newJti);

            logger.info(`[Auth] Refreshed tokens for session: ${sessionId}, user: ${user.id}`);

            return {
                user,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };
        } else {
            // JTI does not match active token! Check if it was previously rotated (Reuse Detection)
            const wasRevoked = await isJtiRevokedInFamily(session.tokenFamilyId, jti);

            if (wasRevoked) {
                // REUSE DETECTED: Possible token theft or replay attack!
                logger.warn(
                    `[SECURITY ALERT] Refresh token reuse detected! Revoking family: ${session.tokenFamilyId}, session: ${sessionId}, user: ${session.userId}`
                );

                // Invalidate the entire token family and session
                await revokeFamily(session.tokenFamilyId);

                throw new UnauthorizedError(
                    "Invalid or expired refresh token. Please log in again."
                );
            }

            // Unrecognized token JTI
            throw new UnauthorizedError("Invalid refresh token");
        }
    } finally {
        await releaseRefreshLock(sessionId);
    }
};

/**
 * Idempotently revokes an authentication session in Redis
 * @param {string} rawRefreshToken
 */
const logoutUser = async (rawRefreshToken) => {
    if (!rawRefreshToken) {
        return true;
    }

    try {
        const decoded = verifyRefreshToken(rawRefreshToken);
        if (decoded && decoded.sid) {
            await revokeSession(decoded.sid);
            logger.info(`[Auth] Session revoked on logout: ${decoded.sid}`);
        }
        if (decoded && decoded.sub) {
            await invalidateUserProfileCache(decoded.sub);
        }
    } catch {
        // Token may be expired or invalid; logout still completes safely
    }

    return true;
};

/**
 * Fetches safe authenticated user profile by ID
 * @param {string} userId
 */
const getUserProfile = async (userId) => {
    if (!userId) {
        throw new UnauthorizedError("User ID not provided");
    }

    // 1. Try to read from lightweight Redis cache first (sub-millisecond latency)
    const cachedUser = await getCachedUserProfile(userId);
    if (cachedUser) {
        return cachedUser;
    }

    // 2. Cache miss: fetch from PostgreSQL database
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!user) {
        throw new NotFoundError("User not found");
    }

    // 3. Populate Redis cache with TTL (15 minutes)
    await setCachedUserProfile(userId, user);

    return user;
};

export {
    sendOTP,
    verifyOTPAndRegister,
    loginUser,
    refreshUserSession,
    logoutUser,
    getUserProfile,
    getCachedUserProfile,
    setCachedUserProfile,
    invalidateUserProfileCache
};

export default {
    sendOTP,
    verifyOTPAndRegister,
    loginUser,
    refreshUserSession,
    logoutUser,
    getUserProfile,
    getCachedUserProfile,
    setCachedUserProfile,
    invalidateUserProfileCache
};