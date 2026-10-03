import Redis from "ioredis";
import config from "../config/index.js";
import logger from "../config/logger.js";

const globalForRedis = globalThis;

export const redis =
    globalForRedis.redis ??
    new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            return Math.min(times * 50, 2000);
        }
    });

if (config.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
}

let isErrorLogged = false;

redis.on("connect", () => {
    logger.info("Redis connected successfully");
    isErrorLogged = false;
});

redis.on("ready", () => {
    logger.info("Redis client ready to receive commands");
    isErrorLogged = false;
});

redis.on("error", (err) => {
    if (!isErrorLogged) {
        logger.error(`Redis connection error: ${err.message}`);
        isErrorLogged = true;
    }
});

redis.on("close", () => {
    logger.warn("Redis connection closed");
});

redis.on("reconnecting", (delay) => {
    if (!isErrorLogged) {
        logger.info(`Redis reconnecting in ${delay}ms...`);
    }
});

export default redis;
