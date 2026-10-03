import cors from "cors";
import config from "../config/index.js";

const rawAllowedOrigins = config.ALLOWED_ORIGINS
    ? config.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["http://localhost:4000", "http://localhost:3000"];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin matches configured allowed origins
        if (rawAllowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // In non-production, allow localhost and 127.0.0.1 variants
        if (config.NODE_ENV !== "production") {
            try {
                const url = new URL(origin);
                if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
                    return callback(null, true);
                }
            } catch {
                // Invalid URL format
            }
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    credentials: true,
    maxAge: 86400 // 24 hours
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
