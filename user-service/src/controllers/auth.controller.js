import config from "../config/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError, UnauthorizedError } from "../utils/error.js";
import { setAuthCookies, clearAuthCookies } from "../utils/cookie.js";
import {
    sendOTP as sendOTPService,
    verifyOTPAndRegister,
    loginUser,
    refreshUserSession,
    logoutUser,
    getUserProfile
} from "../services/auth.service.js";

/**
 * Controller to validate user details and send an OTP for email verification
 */
export const sendOTP = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        LastName,
        email,
        password,
        confirmPass,
        confirmPassword
    } = req.body || {};

    const actualLastName = lastName || LastName;
    const actualConfirmPass = confirmPass || confirmPassword;

    // Validate presence of required inputs
    if (!firstName || !actualLastName || !email || !password || !actualConfirmPass) {
        throw new BadRequestError(
            "All fields (firstName, lastName, email, password, confirmPassword) are mandatory"
        );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new BadRequestError("Please provide a valid email address");
    }

    // Password validation
    if (password.length < 8) {
        throw new BadRequestError("Password must be at least 8 characters long");
    }

    if (password !== actualConfirmPass) {
        throw new BadRequestError("Password and confirm password must match");
    }

    const { otpSessionId, otpSessionID } = await sendOTPService(
        firstName,
        actualLastName,
        email,
        password,
        actualConfirmPass
    );

    const sessionId = otpSessionId || otpSessionID;

    // Set secure HTTP-only cookie with OTP session ID
    res.cookie("otp_session", sessionId, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: config.OTP_TTL * 1000
    });

    return res.status(200).json({
        success: true,
        message: "OTP sent successfully to your email",
        data: {
            otpSessionId: sessionId,
            expiresInSeconds: config.OTP_TTL
        }
    });
});

/**
 * Controller to verify OTP and complete user registration
 */
export const verifyOTP = asyncHandler(async (req, res) => {
    const otpSessionId = req.cookies?.otp_session || req.body?.otpSessionId || req.body?.otpSessionID;
    const { otp } = req.body || {};

    if (!otp) {
        throw new BadRequestError("Verification OTP is required");
    }

    if (!otpSessionId) {
        throw new BadRequestError("OTP session expired or not found. Please request a new OTP.");
    }

    const { user } = await verifyOTPAndRegister(otpSessionId, String(otp));

    // Clear session cookie once verified
    res.clearCookie("otp_session", {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict"
    });

    return res.status(201).json({
        success: true,
        message: "User registered and email verified successfully",
        data: {
            user
        }
    });
});

/**
 * Controller for user login
 * Verifies credentials, generates access & refresh tokens, creates Redis session,
 * sets secure HttpOnly cookies, and returns safe user data.
 */
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        throw new BadRequestError("Email and password are required");
    }

    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString();

    const { user, accessToken, refreshToken } = await loginUser(email, password, {
        userAgent,
        ipAddress
    });

    // Attach secure HttpOnly cookies
    setAuthCookies(res, { accessToken, refreshToken });

    return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            user
        }
    });
});

/**
 * Controller for refresh token rotation
 * Reads refresh token from HttpOnly cookie, validates session, rotates tokens atomically,
 * sets new secure cookies, and returns updated user data.
 */
export const refresh = asyncHandler(async (req, res) => {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!rawRefreshToken) {
        throw new UnauthorizedError("Refresh token is required");
    }

    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString();

    try {
        const { user, accessToken, refreshToken } = await refreshUserSession(rawRefreshToken, {
            userAgent,
            ipAddress
        });

        // Set rotated secure cookies
        setAuthCookies(res, { accessToken, refreshToken });

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: {
                user
            }
        });
    } catch (error) {
        // If refresh fails or is revoked/compromised, ensure cookies are cleared
        clearAuthCookies(res);
        throw error;
    }
});

/**
 * Controller for user logout
 * Idempotently revokes Redis session and clears authentication cookies
 */
export const logout = asyncHandler(async (req, res) => {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    await logoutUser(rawRefreshToken);

    // Safely clear authentication cookies
    clearAuthCookies(res);

    return res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
});

/**
 * Controller to fetch currently authenticated user profile
 */
export const getMe = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const user = await getUserProfile(userId);

    return res.status(200).json({
        success: true,
        message: "Current user profile fetched successfully",
        data: {
            user
        }
    });
});

export default {
    sendOTP,
    verifyOTP,
    login,
    refresh,
    logout,
    getMe
};