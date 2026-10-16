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
    SERVICE_NAME: process.env.SERVICE_NAME || "admin-service",
    PORT: Number(process.env.PORT) || 5006,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:4000",

    // Kafka Broker Configuration
    KAFKA_BROKER: process.env.KAFKA_BROKER || "localhost:9093",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "admin-service"
};

export { config };
export default config;
