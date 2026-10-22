import { AppError, UnauthorizedError, ForbiddenError } from "../utils/error.js";

/**
 * Middleware: getContext
 * Extracts authenticated user context forwarded by the API Gateway
 * (via x-user-id and x-user-role headers) and binds it to req.user.
 */
export const getContext = (req, res, next) => {
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    if (userId) {
        req.user = {
            id: userId,
            role: userRole || "user"
        };
    } else {
        req.user = null;
    }

    next();
};

/**
 * Route guard: requireAuth
 * Enforces that the request has a valid authenticated user context forwarded by the API Gateway.
 */
export const requireAuth = (req, res, next) => {
    const userId = req.user?.id || req.headers["x-user-id"];
    const userRole = req.user?.role || req.headers["x-user-role"];

    if (!userId) {
        return next(new UnauthorizedError("Access Denied: Missing authenticated user context from API Gateway"));
    }

    if (!req.user) {
        req.user = {
            id: userId,
            role: userRole || "user"
        };
    }

    next();
};

/**
 * Route guard: requireAdmin
 * Enforces that the authenticated user has the 'admin' role.
 */
export const requireAdmin = (req, res, next) => {
    const userId = req.user?.id || req.headers["x-user-id"];
    const userRole = req.user?.role || req.headers["x-user-role"];

    if (!userId) {
        return next(new UnauthorizedError("Access Denied: Missing authenticated user context"));
    }

    if (!req.user) {
        req.user = {
            id: userId,
            role: userRole || "user"
        };
    }

    if (req.user.role !== "admin") {
        return next(new ForbiddenError("Forbidden: Administrator privileges required"));
    }

    next();
};


export const authMiddleware = requireAuth;
export default getContext;
