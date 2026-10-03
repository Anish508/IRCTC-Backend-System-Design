import express from "express";
import helmet from "helmet";
import config from "./config/index.js";
import logger from "./config/logger.js";
import { startConsumer, stopConsumer } from "./notification/consumer.js";

const app = express();

app.use(helmet());
app.use(express.json());

// Health Check Endpoints
app.get("/health/live", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: config.SERVICE_NAME
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        service: config.SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

let server;

const startService = async () => {
    try {
        // 1. Start HTTP Server for health probes
        server = app.listen(config.PORT, () => {
            logger.info(
                `[${config.SERVICE_NAME}] HTTP health server running on port ${config.PORT}`
            );
        });

        // 2. Start Kafka Notification Consumer
        await startConsumer();
        logger.info(`[${config.SERVICE_NAME}] Kafka consumer initialized and actively listening.`);
    } catch (error) {
        logger.error(`[${config.SERVICE_NAME}] Failed to start service: ${error.message}`, error);
        process.exit(1);
    }
};

// Graceful Shutdown
let isShuttingDown = false;

const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[${config.SERVICE_NAME}] Received ${signal}. Gracefully stopping service...`);

    const forceExitTimer = setTimeout(() => {
        logger.error(`[${config.SERVICE_NAME}] Shutdown timed out. Forcing process exit.`);
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
        // 1. Disconnect Kafka Consumer
        await stopConsumer();

        // 2. Stop HTTP Server
        if (server) {
            await new Promise((resolve) => server.close(resolve));
            logger.info(`[${config.SERVICE_NAME}] HTTP server stopped.`);
        }

        logger.info(`[${config.SERVICE_NAME}] Graceful shutdown completed.`);
        process.exit(0);
    } catch (err) {
        logger.error(`[${config.SERVICE_NAME}] Error during graceful shutdown: ${err.message}`);
        process.exit(1);
    }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
    logger.error(`[${config.SERVICE_NAME}] Unhandled Rejection:`, reason);
});

process.on("uncaughtException", (error) => {
    logger.error(`[${config.SERVICE_NAME}] Uncaught Exception:`, error.message);
    process.exit(1);
});

startService();
