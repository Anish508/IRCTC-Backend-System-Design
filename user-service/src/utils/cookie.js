import config from "../config/index.js";

/**
 * Returns standard cookie options based on environment and expiry
 * @param {number} maxAge - Cookie max age in milliseconds
 * @returns {object} Express cookie options
 */
export const getCookieOptions = (maxAge) => {
    const isProd = config.NODE_ENV === "production";
    const options = {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/"
    };

    if (maxAge !== undefined) {
        options.maxAge = maxAge;
    }

    if (config.COOKIE_DOMAIN) {
        options.domain = config.COOKIE_DOMAIN;
    }

    return options;
};

/**
 * Attaches secure authentication cookies to the HTTP response
 * @param {import("express").Response} res
 * @param {{ accessToken: string, refreshToken: string }} tokens
 */
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
    if (accessToken) {
        res.cookie("access_token", accessToken, getCookieOptions(config.ACCESS_TOKEN_MAX_AGE_MS));
    }
    if (refreshToken) {
        res.cookie("refresh_token", refreshToken, getCookieOptions(config.REFRESH_TOKEN_MAX_AGE_MS));
    }
};

/**
 * Safely clears authentication cookies from the HTTP response
 * @param {import("express").Response} res
 */
export const clearAuthCookies = (res) => {
    const clearOptions = getCookieOptions();
    delete clearOptions.maxAge;

    res.clearCookie("access_token", clearOptions);
    res.clearCookie("refresh_token", clearOptions);
    // Also clear generic "token" cookie if any existed previously
    res.clearCookie("token", clearOptions);
};

export default {
    getCookieOptions,
    setAuthCookies,
    clearAuthCookies
};
