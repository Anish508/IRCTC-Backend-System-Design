import "dotenv/config";

const config = {
    SERVICE_NAME: process.env.SERVICE_NAME || "notification-service",
    PORT: Number(process.env.PORT) || 5002,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    KAFKA_BROKER: process.env.KAFKA_BROKER || "localhost:9093",
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "notification-service",
    KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "notification-service-group",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    EMAIL_FROM: process.env.EMAIL_FROM || "no-reply@irctc.co.in",
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || "IRCTC NextGen e-Ticketing"
};

export { config };
export default config;
