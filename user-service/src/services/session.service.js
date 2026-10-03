import redis from "../lib/redis.js";
import config from "../config/index.js";
import logger from "../config/logger.js";

/**
 * Key generators following standard naming conventions
 */
const KEYS = {
    session: (sessionId) => `auth:session:${sessionId}`,
    userSessions: (userId) => `auth:user:sessions:${userId}`,
    family: (tokenFamilyId) => `auth:family:${tokenFamilyId}`,
    familyRevoked: (tokenFamilyId) => `auth:family:revoked:${tokenFamilyId}`,
    refreshLock: (sessionId) => `auth:lock:refresh:${sessionId}`
};

/**
 * Creates an active authentication session in Redis
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.userId
 * @param {string} params.tokenFamilyId
 * @param {string} params.jti
 * @param {string} [params.userAgent]
 * @param {string} [params.ipAddress]
 * @returns {Promise<object>} Session data
 */
export const createSession = async ({
    sessionId,
    userId,
    tokenFamilyId,
    jti,
    userAgent = "",
    ipAddress = ""
}) => {
    const ttl = config.REFRESH_TOKEN_TTL_SEC;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    const sessionData = {
        sessionId,
        userId,
        tokenFamilyId,
        jti,
        revoked: false,
        createdAt: now.toISOString(),
        expiresAt,
        userAgent,
        ipAddress
    };

    const multi = redis.multi();
    // 1. Store session JSON
    multi.set(KEYS.session(sessionId), JSON.stringify(sessionData), "EX", ttl);
    // 2. Track session under user's active session set
    multi.sadd(KEYS.userSessions(userId), sessionId);
    multi.expire(KEYS.userSessions(userId), ttl);
    // 3. Map family to current session
    multi.set(KEYS.family(tokenFamilyId), sessionId, "EX", ttl);

    await multi.exec();

    return sessionData;
};

/**
 * Fetches session data from Redis by session ID
 * @param {string} sessionId
 * @returns {Promise<object|null>} Parsed session object or null
 */
export const getSession = async (sessionId) => {
    if (!sessionId) return null;
    const data = await redis.get(KEYS.session(sessionId));
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
};

/**
 * Acquires an atomic lock for rotating a session's refresh token
 * Prevents concurrent refresh race conditions
 * @param {string} sessionId
 * @param {number} [timeoutMs=4000]
 * @returns {Promise<boolean>} True if acquired, false if locked
 */
export const acquireRefreshLock = async (sessionId, timeoutMs = 4000) => {
    const result = await redis.set(KEYS.refreshLock(sessionId), "locked", "NX", "PX", timeoutMs);
    return result === "OK";
};

/**
 * Releases the refresh token lock
 * @param {string} sessionId
 */
export const releaseRefreshLock = async (sessionId) => {
    try {
        await redis.del(KEYS.refreshLock(sessionId));
    } catch (err) {
        logger.warn(`Failed to release refresh lock for session ${sessionId}: ${err.message}`);
    }
};

/**
 * Records a revoked refresh token JTI in the family's revocation history
 * Used for reuse detection
 * @param {string} tokenFamilyId
 * @param {string} jti
 */
export const recordRevokedJti = async (tokenFamilyId, jti) => {
    const ttl = config.REFRESH_TOKEN_TTL_SEC;
    const multi = redis.multi();
    multi.sadd(KEYS.familyRevoked(tokenFamilyId), jti);
    multi.expire(KEYS.familyRevoked(tokenFamilyId), ttl);
    await multi.exec();
};

/**
 * Checks whether a token JTI is present in the family's revoked token history
 * @param {string} tokenFamilyId
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
export const isJtiRevokedInFamily = async (tokenFamilyId, jti) => {
    const result = await redis.sismember(KEYS.familyRevoked(tokenFamilyId), jti);
    return result === 1;
};

/**
 * Updates the session with a new active token JTI after successful rotation
 * @param {string} sessionId
 * @param {string} newJti
 * @returns {Promise<object>} Updated session
 */
export const updateSessionJti = async (sessionId, newJti) => {
    const session = await getSession(sessionId);
    if (!session) return null;

    const ttl = config.REFRESH_TOKEN_TTL_SEC;
    const now = new Date();
    session.jti = newJti;
    session.expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    const multi = redis.multi();
    multi.set(KEYS.session(sessionId), JSON.stringify(session), "EX", ttl);
    multi.expire(KEYS.userSessions(session.userId), ttl);
    multi.expire(KEYS.family(session.tokenFamilyId), ttl);
    await multi.exec();

    return session;
};

// Aliases for backward compatibility
export const recordRevokedToken = recordRevokedJti;
export const isTokenRevokedInFamily = isJtiRevokedInFamily;
export const updateSessionToken = updateSessionJti;

/**
 * Revokes and deletes a single session completely
 * @param {string} sessionId
 */
export const revokeSession = async (sessionId) => {
    if (!sessionId) return;
    const session = await getSession(sessionId);
    if (!session) {
        // Fallback cleanup if session was already removed
        await redis.del(KEYS.session(sessionId));
        return;
    }

    const multi = redis.multi();
    multi.del(KEYS.session(sessionId));
    multi.srem(KEYS.userSessions(session.userId), sessionId);
    multi.del(KEYS.family(session.tokenFamilyId));
    multi.del(KEYS.familyRevoked(session.tokenFamilyId));
    await multi.exec();
};

/**
 * Revokes an entire token family and associated session (called on reuse detection)
 * @param {string} tokenFamilyId
 */
export const revokeFamily = async (tokenFamilyId) => {
    if (!tokenFamilyId) return;
    const sessionId = await redis.get(KEYS.family(tokenFamilyId));
    if (sessionId) {
        await revokeSession(sessionId);
    } else {
        await redis.del(KEYS.family(tokenFamilyId));
        await redis.del(KEYS.familyRevoked(tokenFamilyId));
    }
};

/**
 * Foundation for revoking all active sessions for a user (e.g. logout all devices)
 * @param {string} userId
 */
export const revokeAllUserSessions = async (userId) => {
    if (!userId) return;
    const sessionIds = await redis.smembers(KEYS.userSessions(userId));

    if (sessionIds && sessionIds.length > 0) {
        for (const sid of sessionIds) {
            await revokeSession(sid);
        }
    }

    await redis.del(KEYS.userSessions(userId));
};

export default {
    createSession,
    getSession,
    acquireRefreshLock,
    releaseRefreshLock,
    recordRevokedJti,
    isJtiRevokedInFamily,
    updateSessionJti,
    recordRevokedToken,
    isTokenRevokedInFamily,
    updateSessionToken,
    revokeSession,
    revokeFamily,
    revokeAllUserSessions
};
