# Admin Service

Administrative microservice for the IRCTC Backend platform.

## 📁 Architecture Overview

```
admin-service/
├── prisma/
│   └── schema.prisma        # Database schema definitions
├── src/
│   ├── config/              # Centralized configuration & client re-exports
│   │   ├── index.js         # Environment validation & settings
│   │   ├── kafka.js         # Kafka producer export
│   │   ├── logger.js        # Winston logging setup
│   │   ├── prisma.js        # Prisma client export
│   │   └── redis.js         # Redis client export
│   ├── controllers/         # (Ready for your controller logic)
│   ├── kafka/               # Kafka client & lifecycle management
│   │   └── kafka.js
│   ├── lib/                 # Core database & cache clients
│   │   ├── prisma.js        # Prisma client with connection pooling
│   │   └── redis.js         # ioredis client with auto-reconnect
│   ├── middlewares/         # Security, CORS, logging, error handling
│   │   ├── cors.middleware.js
│   │   ├── error.middleware.js
│   │   ├── getContext.middleware.js
│   │   └── req.middleware.js
│   ├── routes/              # (Ready for your Express route definitions)
│   ├── services/            # (Ready for your business logic services)
│   ├── utils/               # AppError, asyncHandler, helpers
│   │   ├── asyncHandler.js
│   │   ├── error.js
│   │   ├── index.js
│   │   └── logger.js
│   └── index.js             # Express app bootstrap & graceful shutdown
├── .env.example
├── Dockerfile
├── package.json
└── prisma.config.js
```

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=5006
SERVICE_NAME=admin-service
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=postgresql://admin:irctcpass@localhost:5433/admin_service_database
REDIS_URL=redis://:irctcpass@localhost:6380
ALLOWED_ORIGINS=http://localhost:4000

# Kafka Broker Configuration
KAFKA_BROKER=localhost:9093
KAFKA_CLIENT_ID=admin-service
```

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Generate Prisma client
```bash
npx prisma generate
```

### 3. Run database migrations (when database is ready)
```bash
npx prisma migrate dev --name init
```

### 4. Start in development mode
```bash
npm run dev
```

## 🩺 Built-in Health Checks

- `GET /`: Service identification & status
- `GET /health/live`: Liveness check (`{ status: "ok" }`)
- `GET /health`: Readiness probe checking PostgreSQL and Redis connectivity
