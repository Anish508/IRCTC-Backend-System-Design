import "dotenv/config";

const config = {
    SERVICE_NAME: process.env.SERVICE_NAME || "api-gateway",
    PORT: Number(process.env.PORT) || 4000,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173",

    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

    // JWT configuration for auth verification
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "irctc_access_secret_development_only_change_in_production_32chars",
    JWT_ISSUER: process.env.JWT_ISSUER || "irctc-user-service",
    // Rate limiting configuration
    RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes

    // Circuit Breaker Config
    // 1. Request Timeout: Max time to wait for a microservice to respond before aborting (5 seconds)
    CB_REQUEST_TIMEOUT: Number(process.env.CB_REQUEST_TIMEOUT || process.env.CB_TIMEOUT || process.env.SERVICE_TIMEOUT_MS) || 5000,
    CB_TIMEOUT: Number(process.env.CB_REQUEST_TIMEOUT || process.env.CB_TIMEOUT || process.env.SERVICE_TIMEOUT_MS) || 5000,
    SERVICE_TIMEOUT_MS: Number(process.env.SERVICE_TIMEOUT_MS || process.env.CB_REQUEST_TIMEOUT || process.env.CB_TIMEOUT) || 5000,

    // 2. Failure Threshold: Consecutive failures before tripping to OPEN (5 failures)
    CB_THRESHOLD: Number(process.env.CB_THRESHOLD) || 5,

    // 3. Reset Timeout (Cooldown): Time the breaker stays OPEN before testing HALF_OPEN (60 seconds)
    CB_RESET_TIMEOUT: Number(process.env.CB_RESET_TIMEOUT) || 60000,

    // Microservice endpoints
    SERVICES: {
        USER: process.env.USER_SERVICE_URL || "http://localhost:5001",
        BOOKING: process.env.BOOKING_SERVICE_URL || "http://localhost:5002",
        PAYMENT: process.env.PAYMENT_SERVICE_URL || "http://localhost:5003",
        SEARCH: process.env.SEARCH_SERVICE_URL || "http://localhost:5004",
        NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5005",
        ADMIN: process.env.ADMIN_SERVICE_URL || "http://localhost:5006"
    }
};

// Aliases for convenience
config.services = config.SERVICES;

export { config };
export default config;
