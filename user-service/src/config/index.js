import "dotenv/config";

// Validate required environment variables during application startup
const requiredEnvVars = ["DATABASE_URL", "REDIS_URL"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
    throw new Error(
        `[Config Error] Missing required environment variables: ${missingEnvVars.join(", ")}`
    );
}

const config = {
    SERVICE_NAME: process.env.SERVICE_NAME || "user-service",
    PORT: Number(process.env.PORT) || 5001,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:4000",
    OTP_RATE_MAX_PER_HOUR: Number(process.env.OTP_RATE_MAX_PER_HOUR || process.env.MAX_OTP_PER_HOUR) || 5,
    OTP_MAX_VERIFY_ATTEMPTS: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS) || 5,
    OTP_TTL: Number(process.env.OTP_TTL) || 300,
    OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET || "irctc_otp_default_hmac_secret",
    // Kafka Broker Configuration
    KAFKA_BROKER: process.env.KAFKA_BROKER || "localhost:9093",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "user-service",
    // Authentication & JWT configuration
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.ACCESS_TOKEN_SECRET || "irctc_access_secret_development_only_change_in_production_32chars",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET || "irctc_refresh_secret_development_only_change_in_production_32chars",
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    ACCESS_TOKEN_MAX_AGE_MS: 15 * 60 * 1000, // 15 minutes
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    REFRESH_TOKEN_TTL_SEC: 7 * 24 * 60 * 60, // 7 days in seconds (604800s)
    REFRESH_TOKEN_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    JWT_ISSUER: process.env.JWT_ISSUER || "irctc-user-service",
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || "irctc-api",
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
    // Authentication Rate Limiting
    AUTH_LOGIN_RATE_LIMIT_MAX: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX) || 10,
    AUTH_LOGIN_RATE_LIMIT_WINDOW_SEC: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SEC) || 60,
    AUTH_REFRESH_RATE_LIMIT_MAX: Number(process.env.AUTH_REFRESH_RATE_LIMIT_MAX) || 30,
    AUTH_REFRESH_RATE_LIMIT_WINDOW_SEC: Number(process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_SEC) || 60,
    AUTH_OTP_SEND_RATE_LIMIT_MAX: Number(process.env.AUTH_OTP_SEND_RATE_LIMIT_MAX) || 5,
    AUTH_OTP_SEND_RATE_LIMIT_WINDOW_SEC: Number(process.env.AUTH_OTP_SEND_RATE_LIMIT_WINDOW_SEC) || 60,
    AUTH_OTP_VERIFY_RATE_LIMIT_MAX: Number(process.env.AUTH_OTP_VERIFY_RATE_LIMIT_MAX) || 15,
    AUTH_OTP_VERIFY_RATE_LIMIT_WINDOW_SEC: Number(process.env.AUTH_OTP_VERIFY_RATE_LIMIT_WINDOW_SEC) || 60,
    // Redis Cache TTL (in seconds)
    USER_CACHE_TTL: Number(process.env.USER_CACHE_TTL) || 900 // 15 minutes
};

export { config };
export default config;
