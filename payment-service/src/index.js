import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import config from "./config/index.js";
import logger from "./config/logger.js";
import AppError from "./utils/error.js";
import corsMiddleware from "./middlewares/cors.middleware.js";
import getContext from "./middlewares/getContext.middleware.js";
import reqLogger from "./middlewares/req.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import { prisma, pool } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

const app = express();

// Security Middlewares
app.use(helmet());
app.use(corsMiddleware);

// Body Parsing Middlewares with safe size limits
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Extract user identity context from Gateway headers
app.use(getContext);

// Request Logging Middleware
app.use(reqLogger);

// Root Route
app.get("/", (req, res) => {
    res.status(200).json({
        service: config.SERVICE_NAME,
        status: "UP",
        message: `${config.SERVICE_NAME} is healthy and running!`,
        environment: config.NODE_ENV,
        healthCheck: "/health"
    });
});

// Liveness Check Route
app.get("/health/live", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: config.SERVICE_NAME
    });
});

// Infrastructure Readiness & Health Check Route
app.get("/health", async (req, res) => {
    let dbStatus = "healthy";
    let redisStatus = "healthy";
    let isHealthy = true;

    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = "unhealthy";
        isHealthy = false;
    }

    try {
        await redis.ping();
    } catch {
        redisStatus = "unhealthy";
        isHealthy = false;
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
        status: isHealthy ? "ok" : "degraded",
        service: config.SERVICE_NAME,
        timestamp: new Date().toISOString(),
        database: dbStatus,
        redis: redisStatus
    });
});

app.get("/health/ready", (req, res) => {
    res.redirect(307, "/health");
});

// 404 Handler for undefined routes
app.use((req, res, next) => {
    next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

let server;

const startServer = async () => {
    try {
        server = app.listen(config.PORT, () => {
            logger.info(
                `${config.SERVICE_NAME} is running on http://localhost:${config.PORT}`
            );
        });
    } catch (error) {
        logger.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

// Graceful Shutdown Handlers (Idempotent: HTTP Server -> Redis -> Prisma)
let isShuttingDown = false;

const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out. Forcing process exit.");
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
        // 1. Stop accepting new HTTP requests
        if (server) {
            await new Promise((resolve) => server.close(resolve));
            logger.info("HTTP server closed.");
        }

        // 2. Disconnect Redis client
        try {
            await redis.quit();
            logger.info("Redis client disconnected successfully.");
        } catch (err) {
            logger.error(`Error disconnecting Redis: ${err.message}`);
        }

        // 3. Disconnect Prisma client and close pg connection pool
        try {
            await prisma.$disconnect();
            await pool.end();
            logger.info("Database connection pool closed successfully.");
        } catch (err) {
            logger.error(`Error disconnecting Prisma / DB pool: ${err.message}`);
        }

        logger.info("Graceful shutdown completed. Exiting process.");
        process.exit(0);
    } catch (err) {
        logger.error("Error during graceful shutdown:", err.message);
        process.exit(1);
    }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error.message);
    process.exit(1);
});

startServer();
