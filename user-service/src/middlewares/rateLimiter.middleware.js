import redis from "../lib/redis.js";
import config from "../config/index.js";
import logger from "../config/logger.js";
import { TooManyRequestsError } from "../utils/error.js";

/**
 * Creates a Redis-backed rate limiting middleware for authentication endpoints
 * @param {object} options
 * @param {string} options.prefix - Redis key prefix
 * @param {number} options.maxRequests - Maximum allowed requests in window
 * @param {number} options.windowSec - Time window in seconds
 * @returns {import("express").RequestHandler}
 */
export const createAuthRateLimiter = ({ prefix, maxRequests, windowSec }) => {
    return async (req, res, next) => {
        try {
            // Extract client IP (respecting potential reverse proxies/gateways)
            const forwarded = req.headers["x-forwarded-for"];
            const clientIp = (forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress) || "unknown";
            const key = `auth:ratelimit:${prefix}:${clientIp}`;

            // Increment request count atomically
            const current = await redis.incr(key);

            if (current === 1) {
                await redis.expire(key, windowSec);
            }

            const ttl = await redis.ttl(key);
            const remaining = Math.max(0, maxRequests - current);

            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", remaining);
            res.setHeader("X-RateLimit-Reset", Math.max(0, ttl));

            if (current > maxRequests) {
                res.setHeader("Retry-After", Math.max(1, ttl));
                logger.warn(`[RateLimit] Too many attempts for ${prefix} from IP: ${clientIp}`);
                return next(
                    new TooManyRequestsError(
                        "Too many authentication attempts. Please try again later."
                    )
                );
            }

            next();
        } catch (error) {
            // If Redis encounters an error during rate limiting, log warning and fail-open
            // so legitimate authentication requests aren't hard-blocked by a transient Redis hiccup
            logger.warn(`Rate limiter Redis error: ${error.message}`);
            next();
        }
    };
};

/**
 * Pre-configured rate limiter for Login endpoint (10 requests per 60 seconds by default)
 */
export const loginRateLimiter = createAuthRateLimiter({
    prefix: "login",
    maxRequests: config.AUTH_LOGIN_RATE_LIMIT_MAX,
    windowSec: config.AUTH_LOGIN_RATE_LIMIT_WINDOW_SEC
});

/**
 * Pre-configured rate limiter for Refresh endpoint (30 requests per 60 seconds by default)
 */
export const refreshRateLimiter = createAuthRateLimiter({
    prefix: "refresh",
    maxRequests: config.AUTH_REFRESH_RATE_LIMIT_MAX,
    windowSec: config.AUTH_REFRESH_RATE_LIMIT_WINDOW_SEC
});

/**
 * Pre-configured rate limiter for OTP generation endpoint (5 requests per 60 seconds by default)
 */
export const otpSendRateLimiter = createAuthRateLimiter({
    prefix: "send-otp",
    maxRequests: config.AUTH_OTP_SEND_RATE_LIMIT_MAX,
    windowSec: config.AUTH_OTP_SEND_RATE_LIMIT_WINDOW_SEC
});

/**
 * Pre-configured rate limiter for OTP verification endpoint (15 requests per 60 seconds by default)
 */
export const otpVerifyRateLimiter = createAuthRateLimiter({
    prefix: "verify-otp",
    maxRequests: config.AUTH_OTP_VERIFY_RATE_LIMIT_MAX,
    windowSec: config.AUTH_OTP_VERIFY_RATE_LIMIT_WINDOW_SEC
});

export default {
    createAuthRateLimiter,
    loginRateLimiter,
    refreshRateLimiter,
    otpSendRateLimiter,
    otpVerifyRateLimiter
};
