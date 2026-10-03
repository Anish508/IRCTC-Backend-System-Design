# IRCTC-Backend-System-Design

A production-grade, event-driven microservices architecture for an Indian Railway Catering and Tourism Corporation (IRCTC) ticket booking platform, engineered for high availability, fault tolerance, and sub-millisecond scalability.

---

## 🏗️ Architecture Overview

The system is designed following the **API Gateway Pattern**, **Event-Driven Architecture (EDA)**, and **Database-per-Service Pattern**.

```
                           [ Clients / Frontends ]
                                     │
                                     ▼
                           ┌───────────────────┐
                           │    API Gateway    │ (Port 4000)
                           │  - JWT Auth (PEP) │
                           │  - Rate Limiter   │
                           │  - CircuitBreaker │
                           │  - Anti-Spoofing  │
                           └─────────┬─────────┘
                                     │ (x-user-id / x-user-role)
         ┌──────────────┬────────────┼─────────────┬──────────────┐
         ▼              ▼            ▼             ▼              ▼
  ┌─────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────────┐
  │User Service │ │  Booking  │ │  Payment  │ │  Search   │ │  Notification  │
  │ (Port 5001) │ │(Port 5002)│ │(Port 5003)│ │(Port 5004)│ │  (Kafka Cons.) │
  └──────┬──────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬────────┘
         │              │             │             │               │
  ┌──────┴──────┐       │             │       ┌─────┴─────┐         │
  │ PostgreSQL  │       │             │       │Elastic/PG │         │
  │  + Redis    │       │             │       └───────────┘         │
  └─────────────┘       │             │                             │
         │              ▼             ▼                             │
         └──────────► [ Apache Kafka Event Bus (Topics: OTP, Bookings) ]◄───┘
```

---

## 🚀 Microservices

| Service | Port | Description | Stack |
| :--- | :--- | :--- | :--- |
| **`api-gateway`** | `4000` | Single entry point. Terminates JWT auth, rate limits (IP/User/Endpoint with Redis sliding window), circuit breaker, strips client spoofed headers, and proxies requests with verified identity headers (`x-user-id`, `x-user-role`). | Express 5, Axios, Redis, Winston |
| **`user-service`** | `5001` | User registration with Redis OTP validation, credential auth, JWT rotation (access + refresh tokens), session family tracking, and Kafka event publishing. | Node.js, Prisma, PostgreSQL, Redis, Kafka |
| **`booking-service`** | `5002` | Ticket reservation, seat inventory locking, PNR allocation, and transaction workflows. | Node.js, Prisma, PostgreSQL, Redis |
| **`payment-service`** | `5003` | Payment processing, gateway webhooks, idempotent transaction handling, and refund orchestration. | Node.js, Prisma, PostgreSQL, Redis |
| **`search-service`** | `5004` | High-throughput train schedule search, station discovery, and seat availability caching. | Node.js, Prisma, PostgreSQL, Redis |
| **`notification-service`** | `5005` | Event consumer listening to Kafka topics (`user-registered`, `otp-sent`, `booking-confirmed`) for asynchronous email and SMS delivery. | Node.js, KafkaJS, Nodemailer |

---

## 🔒 Security & Gateway Authentication Flow

1. **Authentication Enforcement (PEP)**: The API Gateway intercepts requests to private routes (`/users/user/me`, `/bookings`, `/payments`).
2. **Anti-Spoofing Header Sanitizer**: The Gateway strips any incoming `x-user-id` or `x-user-role` headers from untrusted external clients.
3. **Cryptographic JWT Verification**: Access tokens in HttpOnly cookies or Bearer headers are verified at the gateway edge.
4. **Trusted Header Propagation**: Once verified, the gateway injects `x-user-id: <subId>` and `x-user-role: <role>` into proxied downstream requests.
5. **Context Extraction (`getContext.middleware.js`)**: Downstream services do not verify JWTs again; instead, they extract the trusted identity headers into `req.user`.

---

## ⚙️ Infrastructure & Docker Services

The backend infrastructure is orchestrated with `docker-compose.yml`:

```bash
docker compose up -d
```

- **PostgreSQL 15**: Primary relational database on port `5433`
- **Redis Stack**: Distributed cache & sliding-window rate limiting on port `6380`
- **Apache Kafka + Zookeeper**: Event streaming broker on ports `9092` / `9093`
- **Kafka UI**: Web console for topic inspection on port `8080`
- **Elasticsearch 8 & Kibana**: Log aggregation and full-text search on ports `9200` / `5601`

---

## 🛠️ Quick Start

### 1. Start Infrastructure
```bash
docker compose up -d
```

### 2. Start Services
Each service can be run locally using its respective `package.json`:

```bash
# In api-gateway
cd api-gateway && npm install && npm run dev

# In user-service
cd user-service && npm install && npm run dev
```

---

## 📜 License
ISC
