import { Router } from "express";
import {
    sendOTP,
    verifyOTP,
    login,
    refresh,
    logout,
    getMe
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/getContext.middleware.js";
import {
    loginRateLimiter,
    refreshRateLimiter,
    otpSendRateLimiter,
    otpVerifyRateLimiter
} from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// Existing registration endpoints with Redis-backed rate limiting
router.post("/send-otp", otpSendRateLimiter, sendOTP);
router.post("/verify-otp", otpVerifyRateLimiter, verifyOTP);

// Production-grade authentication endpoints
router.post("/login", loginRateLimiter, login);
router.post("/refresh", refreshRateLimiter, refresh);
router.post("/logout", logout);

// Protected user profile route
router.get("/me", requireAuth, getMe);

export default router;