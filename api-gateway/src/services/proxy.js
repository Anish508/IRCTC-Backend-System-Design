import axios from "axios";
import config from "../config/index.js";
import { logger } from "../utils/index.js";
import AppError, {
    GatewayTimeoutError,
    ServiceUnavailableError
} from "../utils/error.js";

/**
 * CircuitBreaker Pattern:
 * - CLOSED: Normal state. Requests pass through. Failures are counted.
 * - OPEN: Tripped after `threshold` failures. Fast-fails immediately without calling downstream.
 *         Stays OPEN for `resetTimeout` (cooldown: e.g. 60s).
 * - HALF_OPEN: After `resetTimeout` expires, allows ONE trial request.
 *              Success -> CLOSED (reset). Failure -> OPEN for another `resetTimeout`.
 */
class CircuitBreaker {
    constructor(
        serviceName,
        threshold = config.CB_THRESHOLD,
        resetTimeout = config.CB_RESET_TIMEOUT
    ) {
        this.serviceName = serviceName;
        this.failureCount = 0;
        this.threshold = threshold;          // e.g. 5 failures before opening
        this.resetTimeout = resetTimeout;    // e.g. 60,000ms (60s) cooldown period in OPEN state
        this.state = "CLOSED";               // CLOSED | OPEN | HALF_OPEN
        this.lastFailureTime = 0;
        this.nextAttempt = Date.now();       // Timestamp when HALF_OPEN test is allowed
    }

    async execute(request) {
        if (this.state === "OPEN") {
            if (Date.now() < this.nextAttempt) {
                const waitSeconds = Math.ceil((this.nextAttempt - Date.now()) / 1000);
                throw new AppError(
                    `${this.serviceName} is temporarily unavailable. Circuit breaker is OPEN. Try again in ${waitSeconds}s`,
                    503
                );
            }

            // Cooldown period expired: switch to HALF_OPEN to test service recovery
            this.state = "HALF_OPEN";
            logger.info(`[CircuitBreaker] ${this.serviceName} is HALF_OPEN. Allowing 1 trial request...`);
        }

        try {
            const response = await request();
            this.onSuccess();
            return response;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === "HALF_OPEN") {
            this.state = "CLOSED";
            logger.info(`[CircuitBreaker] ${this.serviceName} trial request succeeded. Circuit is now CLOSED`);
        }
    }

    onFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        // If threshold reached while CLOSED, or if the trial request failed while HALF_OPEN
        if (this.failureCount >= this.threshold || this.state === "HALF_OPEN") {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.resetTimeout; // Set 60s cooldown timer
            logger.error(
                `[CircuitBreaker] ${this.serviceName} tripped to OPEN (failures: ${this.failureCount}). Cooldown for ${this.resetTimeout / 1000}s`
            );
        }
    }

    getState() {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.nextAttempt
        };
    }
}

// Initializing circuit breakers for each microservice
const circuitBreakers = {
    userService: new CircuitBreaker("user-service"),
    searchService: new CircuitBreaker("search-service"),
    bookingService: new CircuitBreaker("booking-service"),
    paymentService: new CircuitBreaker("payment-service"),
    notificationService: new CircuitBreaker("notification-service")
};

/**
 * Forward request to downstream service
 */
async function forwardRequest(serviceUrl, path, method, data, headers, circuitBreaker) {
    const url = `${serviceUrl}${path}`;
    const timeoutMs = config.SERVICE_TIMEOUT_MS || config.CB_REQUEST_TIMEOUT || 5000;

    const cleanHeaders = { ...headers };
    delete cleanHeaders.host;
    delete cleanHeaders["content-length"];

    const requestConfig = {
        method,
        url,
        timeout: timeoutMs,
        headers: cleanHeaders,
        // Important: Don't validate status, let service response through
        validateStatus: () => true,
        // Set max redirects
        maxRedirects: 5
    };

    // Add data based on method
    if (method !== "GET" && method !== "DELETE" && data) {
        requestConfig.data = data;
    }

    // For GET and DELETE, add params if data exists
    if ((method === "GET" || method === "DELETE") && data) {
        requestConfig.params = data;
    }

    logger.debug(`Forwarding ${method} ${url}`, {
        headers: requestConfig.headers,
        hasData: !!data,
        timeout: timeoutMs
    });

    try {
        const response = await circuitBreaker.execute(() => axios(requestConfig));

        logger.debug(`Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText
        });

        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        };
    } catch (err) {
        // Re-throw circuit breaker or operational errors directly
        if (err instanceof AppError) {
            throw err;
        }

        logger.error(`Error forwarding to ${serviceUrl}:`, {
            message: err.message,
            code: err.code,
            url,
            method,
            timeout: timeoutMs
        });

        if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
            throw new GatewayTimeoutError(`Request to ${serviceUrl} timed out after ${timeoutMs}ms`);
        }

        if (err.code === "ECONNREFUSED") {
            throw new ServiceUnavailableError(`Cannot connect to ${serviceUrl}. Service may be down.`);
        }

        if (err.response) {
            logger.error(`Service error from ${serviceUrl}:`, {
                status: err.response.status,
                data: err.response.data
            });

            return {
                status: err.response.status,
                data: err.response.data,
                headers: err.response.headers
            };
        }

        // Network error or service down
        logger.error(`Network error while calling ${serviceUrl}:`, err.message);
        throw new ServiceUnavailableError(`Service temporarily unavailable: ${err.message}`);
    }
}

function createProxy(serviceName, serviceUrl) {
    let circuitBreaker = circuitBreakers[serviceName];

    if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker(serviceName);
        circuitBreakers[serviceName] = circuitBreaker;
    }

    return async (req, res, next) => {
        try {
            // Extract path (support both /api/users/... and /users/...)
            const rawParts = req.path.split("/").filter(Boolean);
            const pathParts = rawParts[0] === "api" ? rawParts.slice(1) : rawParts;

            // Remove service prefix (e.g. 'users'), keep the rest ('auth/login')
            const servicePath = pathParts.length > 1 ? "/" + pathParts.slice(1).join("/") : "/";
            const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";

            const result = await forwardRequest(
                serviceUrl,
                servicePath + queryString,
                req.method,
                req.body,
                req.headers,
                circuitBreaker
            );

            // Forward response headers (excluding hop-by-hop and encoding headers)
            const excludeHeaders = [
                "connection",
                "keep-alive",
                "transfer-encoding",
                "host",
                "content-length",
                "content-encoding"
            ];
            Object.keys(result.headers || {}).forEach((key) => {
                if (!excludeHeaders.includes(key.toLowerCase())) {
                    res.setHeader(key, result.headers[key]);
                }
            });

            // Send response
            res.status(result.status).json(result.data);
        } catch (err) {
            next(err);
        }
    };
}

/**
 * Health check endpoint for circuit breakers
 */
function getCircuitBreakerStatus() {
    return Object.values(circuitBreakers).map((cb) => cb.getState());
}

export { CircuitBreaker, createProxy, circuitBreakers, getCircuitBreakerStatus, forwardRequest };
export default { CircuitBreaker, createProxy, circuitBreakers, getCircuitBreakerStatus, forwardRequest };
