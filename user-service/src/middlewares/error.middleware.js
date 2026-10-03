import logger from "../config/logger.js";
import AppError from "../utils/error.js";

const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof AppError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || "Internal Server Error";
        error = new AppError(message, statusCode, error.errors || []);
        error.stack = err.stack;
    }

    const { statusCode, message, errors } = error;

    logger.error(`[${req.method}] ${req.originalUrl} - ${statusCode} - ${message}`);
    if (process.env.NODE_ENV !== "production" && error.stack) {
        logger.debug(error.stack);
    }

    res.status(statusCode).json({
        success: false,
        status: error.status,
        message,
        ...(errors && errors.length > 0 ? { errors } : {}),
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {})
    });
};

export default errorHandler;
