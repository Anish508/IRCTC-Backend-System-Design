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
    constructor(message = "Bad Request", errors = []) {
        super(message, 400, errors);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", errors = []) {
        super(message, 401, errors);
    }
}

class ForbiddenError extends AppError {
    constructor(message = "Forbidden", errors = []) {
        super(message, 403, errors);
    }
}

class NotFoundError extends AppError {
    constructor(message = "Resource Not Found", errors = []) {
        super(message, 404, errors);
    }
}

class ConflictError extends AppError {
    constructor(message = "Conflict occurred", errors = []) {
        super(message, 409, errors);
    }
}

export {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError
};
export default AppError;

