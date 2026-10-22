import { Router } from "express";
import { config } from "../config/index.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { endpointRateLimit, combinedRateLimit } from "../middlewares/rateLimit.middleware.js";
import { createProxy, getCircuitBreakerStatus } from "../services/proxy.js";

const router = Router();

// Create proxies for microservices
const userServiceProxy = createProxy("userService", config.services.USER);
const bookingServiceProxy = createProxy("bookingService", config.services.BOOKING);
const searchServiceProxy = createProxy("searchService", config.services.SEARCH);
const paymentServiceProxy = createProxy("paymentService", config.services.PAYMENT);
const adminServiceProxy = createProxy("adminService", config.services.ADMIN);

// -------------------------------------------------------------
// Gateway Health & Circuit Breaker Monitoring
// -------------------------------------------------------------
router.get("/gateway/health", (req, res) => {
    res.status(200).json({
        message: "Gateway is running",
        timestamp: new Date().toISOString()
    });
});

router.get("/gateway/circuit-breakers", (req, res) => {
    res.status(200).json({
        circuitBreakers: getCircuitBreakerStatus()
    });
});

// -------------------------------------------------------------
// User Service Routes
// -------------------------------------------------------------
// Public authentication endpoints with strict rate limiting
router.post(
    "/users/auth/login",
    endpointRateLimit(10, 900000), // 10 requests per 15 minutes
    userServiceProxy
);

// Private profile route requiring authentication
router.get(
    "/users/user/me",
    authMiddleware(),
    combinedRateLimit(),
    userServiceProxy
);

// Fallback route forwarding for other user routes (e.g. send-otp, verify-otp, refresh, logout)
router.use("/users", userServiceProxy);

// -------------------------------------------------------------
// Other Microservice Routes
// -------------------------------------------------------------
// Booking routes require authentication (attaches x-user-id & x-user-role)
router.use("/bookings", authMiddleware(), bookingServiceProxy);

// Search routes are public (search trains, availability, stations)
router.use("/search", searchServiceProxy);

// Payment routes require authentication (payment webhooks can be exempted if needed)
router.post("/payments/webhook", paymentServiceProxy);
router.use("/payments", authMiddleware(), paymentServiceProxy);

// Admin routes require authentication (attaches x-user-id & x-user-role)
router.use("/admin", authMiddleware(), adminServiceProxy);

export default router;

