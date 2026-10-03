import winston from "winston";
import config from "./index.js";

const { combine, timestamp, printf, errors, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] [${level}] [${config.SERVICE_NAME}]: ${stack || message}`;
});

const logger = winston.createLogger({
    level: config.LOG_LEVEL || "info",
    format: combine(
        timestamp({ format: () => new Date().toISOString() }),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: config.NODE_ENV === "development"
                ? combine(colorize(), logFormat)
                : logFormat
        })
    ]
});

export { logger };
export default logger;
