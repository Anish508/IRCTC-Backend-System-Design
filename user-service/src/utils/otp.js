import crypto from "crypto";
import redis from "../lib/redis.js";
import config from "../config/index.js";
import { TooManyRequestsError, BadRequestError } from "./error.js";

/**
 * Computes an HMAC SHA-256 hash for email + OTP
 * @param {string} email
 * @param {string} otp
 * @returns {string} hex digest
 */
function hmacFor(email, otp) {
    return crypto
        .createHmac("sha256", config.OTP_HMAC_SECRET)
        .update(`${email.toLowerCase().trim()}:${otp.trim()}`)
        .digest("hex");
}

/**
 * Generates a cryptographically secure 6-digit OTP and stores its HMAC hash in Redis
 * @param {string|object} emailOrData - email string or an object containing email and metadata
 * @param {object} [metaData={}] - additional metadata to store in the session
 * @returns {Promise<{otp: string, otpSessionId: string, otpSessionID: string}>}
 */
async function generateAndStoreOtp(emailOrData, metaData = {}) {
    let email;
    let meta;

    if (typeof emailOrData === "object" && emailOrData !== null) {
        email = emailOrData.email;
        meta = { ...emailOrData };
    } else {
        email = emailOrData;
        meta = { email, ...metaData };
    }

    if (!email) {
        throw new BadRequestError("Valid email is required for OTP generation");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limiting check (e.g. max 5 OTPs per hour)
    const rateKey = `otp:rate:${normalizedEmail}`;
    const currentRateCount = await redis.get(rateKey);
    const sentCount = parseInt(currentRateCount || "0", 10);

    if (sentCount >= config.OTP_RATE_MAX_PER_HOUR) {
        throw new TooManyRequestsError(
            `Too many OTP requests. Maximum ${config.OTP_RATE_MAX_PER_HOUR} requests allowed per hour. Please try again later.`,
            "OTP_RATE_LIMIT"
        );
    }

    // 2. Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 3. Generate unique session ID for the OTP verification flow
    const otpSessionId = crypto.randomUUID();

    // 4. Compute HMAC hash of the OTP for secure comparison
    const hashedOtp = hmacFor(normalizedEmail, otp);

    // 5. Store session in Redis with TTL (default 5 minutes)
    const sessionData = {
        email: normalizedEmail,
        hashedOtp,
        meta,
        attempts: 0,
        createdAt: new Date().toISOString()
    };

    await redis.set(
        `otp:session:${otpSessionId}`,
        JSON.stringify(sessionData),
        "EX",
        config.OTP_TTL
    );

    // 6. Update rate limit counter with a 1-hour sliding window
    const multi = redis.multi();
    multi.incr(rateKey);
    if (!currentRateCount) {
        multi.expire(rateKey, 3600); // 1 hour expiration from first request
    }
    await multi.exec();

    return {
        otp,
        otpSessionId,
        otpSessionID: otpSessionId // provide both casings for backward compatibility
    };
}

/**
 * Verifies an OTP against a stored session with brute-force protection
 * @param {string} sessionId
 * @param {string} otp
 * @returns {Promise<{verified: boolean, email: string, meta: object}>}
 */
async function verifyOtp(sessionId, otp) {
    if (!sessionId || !otp) {
        throw new BadRequestError("OTP session ID and OTP are required for verification");
    }

    const sessionKey = `otp:session:${sessionId}`;
    const sessionRaw = await redis.get(sessionKey);

    if (!sessionRaw) {
        throw new BadRequestError("OTP has expired or session is invalid. Please request a new OTP.");
    }

    const session = JSON.parse(sessionRaw);

    // 1. Check if max verification attempts exceeded
    if (session.attempts >= config.OTP_MAX_VERIFY_ATTEMPTS) {
        await redis.del(sessionKey);
        throw new BadRequestError(
            "Maximum OTP verification attempts exceeded. For security, this OTP is now invalid. Please request a new OTP.",
            "OTP_MAX_ATTEMPTS_EXCEEDED"
        );
    }

    // 2. Timing-safe comparison using HMAC hashes
    const expectedHash = session.hashedOtp;
    const actualHash = hmacFor(session.email, otp);

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const actualBuffer = Buffer.from(actualHash, "hex");

    const isMatch =
        expectedBuffer.length === actualBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isMatch) {
        session.attempts += 1;
        const ttl = await redis.ttl(sessionKey);

        if (ttl > 0) {
            await redis.set(sessionKey, JSON.stringify(session), "EX", ttl);
        }

        const remainingAttempts = config.OTP_MAX_VERIFY_ATTEMPTS - session.attempts;
        if (remainingAttempts <= 0) {
            await redis.del(sessionKey);
            throw new BadRequestError("Maximum verification attempts exceeded. Please request a new OTP.");
        }

        throw new BadRequestError(
            `Invalid OTP. You have ${remainingAttempts} attempt(s) remaining.`
        );
    }

    // 3. OTP verified successfully - invalidate the session to prevent replay attacks
    await redis.del(sessionKey);

    return {
        verified: true,
        email: session.email,
        meta: session.meta
    };
}

export { generateAndStoreOtp, verifyOtp, hmacFor };
export default {
    generateAndStoreOtp,
    verifyOtp,
    hmacFor
};
