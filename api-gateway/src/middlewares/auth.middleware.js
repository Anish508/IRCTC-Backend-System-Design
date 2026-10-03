import jwt from "jsonwebtoken";
import config from "../config/index.js";
import logger from "../config/logger.js";
import { UnauthorizedError } from "../utils/error.js";

/**
 * Authentication middleware for API Gateway
 * Extracts JWT access token from HttpOnly cookies or Authorization header,
 * verifies signature and expiration, attaches authenticated user to req.user,
 * and sets x-user-id and x-user-role headers for downstream microservices.
 */
const authMiddleware = (req, res, next) => {
    // If called as a factory function (e.g. router.get(..., authMiddleware(), ...))
    if (!req || typeof req !== "object" || !req.headers) {
        return (actualReq, actualRes, actualNext) => authMiddleware(actualReq, actualRes, actualNext);
    }

    try {
        // 1. Extract token from HttpOnly cookie (primary) or Bearer header (fallback)
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const bearerToken = authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

        const token = req.cookies?.access_token || req.cookies?.token || bearerToken;

        if (!token) {
            return next(new UnauthorizedError("Access Denied: No token provided"));
        }

        // 2. Verify token signature, expiration, issuer, and audience
        let decoded;
        try {
            const verifyOptions = {};
            if (config.JWT_ISSUER) verifyOptions.issuer = config.JWT_ISSUER;
            if (config.JWT_AUDIENCE) verifyOptions.audience = config.JWT_AUDIENCE;

            decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, verifyOptions);
        } catch (jwtError) {
            if (jwtError.name === "TokenExpiredError") {
                return next(new UnauthorizedError("Access token expired"));
            }
            return next(new UnauthorizedError("Invalid access token"));
        }

        if (!decoded || !decoded.sub) {
            return next(new UnauthorizedError("Invalid token payload"));
        }

        // 3. Attach authenticated user identity
        req.user = {
            id: decoded.sub,
            role: decoded.role || "user",
            jti: decoded.jti
        };

        // 4. Forward authenticated identity headers to downstream microservices
        req.headers["x-user-id"] = decoded.sub;
        req.headers["x-user-role"] = decoded.role || "user";

        next();
    } catch (error) {
        logger.error(`Authentication middleware error: ${error.message}`);
        return next(new UnauthorizedError("Authentication failed"));
    }
};

export { authMiddleware };
export default authMiddleware;
