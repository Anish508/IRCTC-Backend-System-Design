import { UnauthorizedError } from "../utils/error.js";

/**
 * Middleware: getContext
 * Extracts authenticated user context forwarded by the API Gateway
 * (via x-user-id and x-user-role headers) and binds it to req.user.
 *
 * Safe for global use across all routes.
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
 * Route guard: requireAuth (alias: authMiddleware)
 * Enforces that the request has a valid authenticated user context forwarded by the API Gateway.
 * Returns 401 Unauthorized if the user identity is absent.
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

export const authMiddleware = requireAuth;
export default getContext;
