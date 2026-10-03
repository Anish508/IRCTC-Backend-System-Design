import {
    rateLimiter,
    ipRateLimit,
    userRateLimit,
    endpointRateLimit,
    combinedRateLimit
} from "./rateLimiter.middleware.js";

// Alias ipRateLim to ipRateLimit for convenience
const ipRateLim = ipRateLimit;

export {
    rateLimiter,
    ipRateLimit,
    ipRateLim,
    userRateLimit,
    endpointRateLimit,
    combinedRateLimit
};

export default {
    rateLimiter,
    ipRateLimit,
    ipRateLim,
    userRateLimit,
    endpointRateLimit,
    combinedRateLimit
};
