import asyncHandler from "./asyncHandler.js";
import AppError, {
    BadRequestError,
    BadRequest,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    conflictError,
    TooManyRequestsError,
    TooManyRequest,
    InternalServerError
} from "./error.js";
import logger from "../config/logger.js";

export {
    asyncHandler,
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
    logger
};

export default {
    asyncHandler,
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
    logger
};
