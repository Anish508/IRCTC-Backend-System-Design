import cors from "cors";
import config from "../config/index.js";

const corsOptions = {
    origin: config.ALLOWED_ORIGINS
        ? (config.ALLOWED_ORIGINS === "*" ? "*" : config.ALLOWED_ORIGINS.split(","))
        : "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-role"],
    credentials: true
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
