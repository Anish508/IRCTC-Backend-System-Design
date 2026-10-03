class AppError extends Error {
    constructor(message, statusCode = 500, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = "Bad request", errors = []) {
        super(message, 400, errors);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized access", errors = []) {
        super(message, 401, errors);
    }
}

class ForbiddenError extends AppError {
    constructor(message = "Forbidden access", errors = []) {
        super(message, 403, errors);
    }
}

class NotFoundError extends AppError {
    constructor(message = "Resource not found", errors = []) {
        super(message, 404, errors);
    }
}

class ConflictError extends AppError {
    constructor(message = "Conflict occurred", errors = []) {
        super(message, 409, errors);
    }
}

class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests. Please try again later.", errorCodeOrRetryAfter = "TOO_MANY_REQUESTS", retryAfter = null) {
        super(message, 429);
        if (typeof errorCodeOrRetryAfter === "number") {
            this.errorCode = "TOO_MANY_REQUESTS";
            this.retryAfter = errorCodeOrRetryAfter;
        } else {
            this.errorCode = errorCodeOrRetryAfter;
            this.retryAfter = retryAfter;
        }
    }
}

class InternalServerError extends AppError {
    constructor(message = "Internal server error", errors = []) {
        super(message, 500, errors);
    }
}

class ServiceUnavailableError extends AppError {
    constructor(message = "Service unavailable", errors = []) {
        super(message, 503, errors);
    }
}

class GatewayTimeoutError extends AppError {
    constructor(message = "Gateway timeout", errors = []) {
        super(message, 504, errors);
    }
}

// Aliases for compatibility
const BadRequest = BadRequestError;
const conflictError = ConflictError;
const TooManyRequest = TooManyRequestsError;

export {
    AppError,
    BadRequestError,
    BadRequest,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    conflictError,
    TooManyRequestsError,
    TooManyRequest,
    InternalServerError,
    ServiceUnavailableError,
    GatewayTimeoutError
};

export default AppError;
