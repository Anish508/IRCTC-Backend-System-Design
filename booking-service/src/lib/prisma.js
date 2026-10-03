import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import config from "../config/index.js";

// Native PostgreSQL connection pool
export const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis;

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: config.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"]
    });

if (config.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
