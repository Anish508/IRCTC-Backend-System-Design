import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

/**
 * Generates a signed, short-lived JWT access token
 * @param {object} user - User object containing id and role
 * @returns {string} Signed JWT access token
 */
export const generateAccessToken = (user) => {
    const payload = {
        sub: user.id,
        jti: crypto.randomUUID(),
        role: user.role || "user"
    };

    return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
        expiresIn: config.ACCESS_TOKEN_EXPIRY,
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
    });
};

/**
 * Generates a signed, long-lived JWT refresh token bound to a session and family
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.sessionId
 * @param {string} params.tokenFamilyId
 * @param {string} [params.jti]
 * @returns {{ token: string, jti: string }} Signed JWT refresh token and unique jti
 */
export const generateRefreshToken = ({ userId, sessionId, tokenFamilyId, jti = crypto.randomUUID() }) => {
    const payload = {
        sub: userId,
        sid: sessionId,
        fid: tokenFamilyId,
        jti
    };

    const token = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
        expiresIn: config.REFRESH_TOKEN_EXPIRY,
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
    });

    return { token, jti };
};

/**
 * Verifies and decodes an access token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
export const verifyAccessToken = (token) => {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
    });
};

/**
 * Verifies and decodes a refresh token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.JWT_REFRESH_SECRET, {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
    });
};

export default {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};
