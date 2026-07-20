# LMS Backend — Production-Grade Architecture Plan

A comprehensive backend architecture for a Learning Management System, designed for scale, maintainability, and developer ergonomics.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Runtime** | Node.js 20 LTS | Async I/O fits media streaming & real-time events |
| **Framework** | Express.js + custom router factory | Lightweight, battle-tested, full control |
| **Database** | PostgreSQL 16 | Relational integrity for courses/enrollments/grades |
| **ORM** | Prisma | Type-safe, migrations-first, excellent DX |
| **Cache / Session** | Redis 7 | Token blacklist, rate limiting, course progress cache |
| **Queue** | BullMQ (on Redis) | Video transcoding jobs, email dispatch, certificate gen |
| **File Storage** | AWS S3 / MinIO (self-hosted) | Video, PDF, assignments |
| **Video Streaming** | HLS via FFmpeg worker | Adaptive bitrate, resume support |
| **Auth** | JWT (Access + Refresh) + OAuth2 (Google) | Stateless API, SSO support |
| **Real-time** | Socket.IO | Live quizzes, class chat, progress events |
| **Email** | Nodemailer + SMTP / SendGrid | Enrollment confirmation, cert delivery |
| **Docs** | Swagger / OpenAPI 3.0 | Auto-generated from route decorators |
| **Testing** | Jest + Supertest | Unit + integration |
| **Containerization** | Docker + Docker Compose | Dev parity, easy K8s migration |
| **Process Manager** | PM2 (prod) | Cluster mode, graceful restarts |

---

## Folder Structure

```
lms-backend/
├── src/
│   ├── api/                        # Route definitions grouped by domain
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── users/
│   │   ├── courses/
│   │   ├── lessons/
│   │   ├── enrollments/
│   │   ├── quizzes/
│   │   ├── assignments/
│   │   ├── payments/
│   │   ├── certificates/
│   │   ├── notifications/
│   │   └── admin/
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT verify, role guard
│   │   ├── rateLimiter.js           # Redis-backed per-route limits
│   │   ├── upload.middleware.js     # Multer + S3 stream
│   │   ├── validate.middleware.js   # Zod schema validation
│   │   ├── errorHandler.js          # Global error boundary
│   │   └── requestLogger.js         # Morgan + correlation IDs
│   │
│   ├── config/
│   │   ├── index.js                 # Env loader with validation (zod)
│   │   ├── database.js              # Prisma client singleton
│   │   ├── redis.js                 # IORedis singleton
│   │   ├── s3.js                    # AWS SDK client
│   │   └── swagger.js               # OpenAPI spec builder
│   │
│   ├── workers/                     # BullMQ processors (run as separate process)
│   │   ├── video.worker.js          # FFmpeg HLS transcoding
│   │   ├── email.worker.js          # Transactional emails
│   │   ├── certificate.worker.js    # PDF certificate generation
│   │   └── analytics.worker.js     # Aggregate watch-time, scores
│   │
│   ├── queues/                      # Queue producers
│   │   ├── video.queue.js
│   │   ├── email.queue.js
│   │   └── certificate.queue.js
│   │
│   ├── sockets/                     # Socket.IO namespaces
│   │   ├── index.js
│   │   ├── quiz.socket.js           # Real-time quiz sessions
│   │   └── chat.socket.js           # Course discussion
│   │
│   ├── jobs/                        # Scheduled cron jobs
│   │   ├── scheduler.js
│   │   ├── expireEnrollments.job.js
│   │   └── generateAnalytics.job.js
│   │
│   ├── utils/
│   │   ├── ApiResponse.js           # Standardized response envelope
│   │   ├── ApiError.js              # Custom error classes
│   │   ├── asyncHandler.js          # try/catch wrapper for controllers
│   │   ├── pagination.js            # Cursor + offset pagination helpers
│   │   ├── jwtUtils.js
│   │   └── fileUtils.js
│   │
│   ├── constants/
│   │   ├── roles.js                 # STUDENT | INSTRUCTOR | ADMIN
│   │   ├── courseStatus.js
│   │   └── httpStatus.js
│   │
│   └── app.js                       # Express app factory
│
├── prisma/
│   ├── schema.prisma                # Single source of truth for DB schema
│   └── migrations/                  # Auto-generated migration files
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── nginx.conf                   # Reverse proxy + static HLS
│
├── scripts/
│   ├── seed.js                      # DB seeding
│   └── generateKeys.js              # RSA keypair for JWT
│
├── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
└── package.json
```

---

## Database Schema (Prisma)

### Core Entities

```
User           → Role (STUDENT | INSTRUCTOR | ADMIN)
Course         → Category, Instructor(User), Sections
Section        → Course, Lessons (ordered)
Lesson         → Section, Media (Video | Article | Quiz)
Enrollment     → User ↔ Course (with status, progress %)
LessonProgress → User ↔ Lesson (watched seconds, completed)
Quiz           → Lesson, Questions
QuizAttempt    → User ↔ Quiz (score, answers JSON)
Assignment     → Lesson
Submission     → User ↔ Assignment (file URL, grade)
Certificate    → User ↔ Course (issued on completion)
Payment        → User ↔ Course (Stripe/Razorpay order ref)
Review         → User ↔ Course (rating 1-5, comment)
Notification   → User (type, payload JSON, read flag)
RefreshToken   → User (token hash, expiresAt)
```

### Key Design Decisions
- **Soft deletes** on `Course`, `User` via `deletedAt`
- **Optimistic concurrency** on `LessonProgress` with `updatedAt`
- **JSONB** for quiz answers and flexible lesson metadata
- **Separate `Media` table** to support future content types without schema changes

---

## API Design

### Base URL: `/api/v1`

| Domain | Endpoints |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/google` |
| **Users** | `GET /users/me`, `PATCH /users/me`, `GET /users/:id` (admin) |
| **Courses** | Full CRUD, `GET /courses` (paginated/filtered), `POST /courses/:id/publish` |
| **Sections** | CRUD under `/courses/:courseId/sections` |
| **Lessons** | CRUD under `/sections/:sectionId/lessons`, `POST /lessons/:id/progress` |
| **Enrollments** | `POST /enrollments`, `GET /enrollments/me`, `DELETE /enrollments/:id` |
| **Quizzes** | `POST /quizzes/:id/attempt`, `GET /quizzes/:id/results` |
| **Assignments** | `POST /assignments/:id/submit`, `PATCH /submissions/:id/grade` |
| **Payments** | `POST /payments/initiate`, `POST /payments/webhook` |
| **Certificates** | `GET /certificates/me`, `GET /certificates/:id/verify` |
| **Admin** | `/admin/users`, `/admin/courses`, `/admin/analytics` |

### Response Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "data": { },
  "message": "Course fetched",
  "meta": { "page": 1, "total": 100, "limit": 20 }
}
```

---

## Authentication & Authorization

- **Access Token**: JWT, 15-min TTL, signed with RSA256 private key
- **Refresh Token**: Opaque random token, 30-day TTL, stored (hashed) in DB + Redis
- **Token Rotation**: Refresh issues new access + refresh, old refresh invalidated
- **Blacklist**: Revoked tokens cached in Redis with TTL matching token expiry
- **RBAC**: Role checked in middleware `requireRole('INSTRUCTOR', 'ADMIN')`
- **Resource Ownership**: Service layer verifies `course.instructorId === req.user.id`

---

## Video Pipeline

```
Upload (multipart) → S3 Raw Bucket
     ↓
BullMQ Video Queue
     ↓
FFmpeg Worker: generates HLS segments (360p, 720p, 1080p) + thumbnail
     ↓
S3 Processed Bucket (HLS manifests + .ts segments)
     ↓
CloudFront / Nginx signed URL → Client
     ↓
LessonProgress updated via /lessons/:id/progress (heartbeat every 30s)
```

---

## Real-time (Socket.IO)

| Namespace | Events |
|---|---|
| `/quiz` | `start_quiz`, `answer`, `quiz_result`, `leaderboard` |
| `/chat` | `join_room`, `message`, `typing`, `read_receipt` |
| `/progress` | `lesson_complete` (emitted by server after progress save) |

- Auth middleware on Socket handshake (JWT in `auth` payload)
- Rooms keyed by `courseId` / `quizSessionId`

---

## Caching Strategy (Redis)

| Key Pattern | TTL | Use Case |
|---|---|---|
| `course:{id}` | 5 min | Course detail page |
| `courses:list:{hash}` | 2 min | Paginated course listing |
| `user:{id}:enrollments` | 10 min | My courses sidebar |
| `ratelimit:{ip}:{route}` | sliding | Rate limiting |
| `refresh:{tokenHash}` | 30 days | Refresh token store |
| `blacklist:{jti}` | token TTL | Revoked access tokens |

Cache invalidation on mutation via service layer (write-through).

---

## DevOps

### Docker Services
```yaml
services:
  api:       # Node.js Express (port 4000)
  worker:    # BullMQ workers (separate process)
  db:        # PostgreSQL 16
  redis:     # Redis 7
  minio:     # S3-compatible local storage
  nginx:     # Reverse proxy + HLS file server
```

### Environment Tiers
- `development`  — local Docker Compose, MinIO
- `staging`      — same compose on VPS, swap MinIO → real S3
- `production`   — PM2 cluster / K8s, managed DB (RDS/Supabase), CloudFront CDN

---

## Scaffold Order (Implementation Sequence)

1. `prisma/schema.prisma`           — Full DB schema
2. `docker-compose.yml`             — All services
3. `src/app.js` + `src/config/`    — App bootstrap
4. `src/middleware/`                — Error handler, logger, validate, auth
5. `src/api/auth/`                  — Register, login, refresh, logout
6. `src/api/users/` + `src/api/courses/`     — Core domain
7. `src/api/enrollments/` + `src/api/lessons/` — Learning flow
8. `src/workers/` + `src/queues/`  — Async jobs
9. `src/sockets/`                   — Real-time layer
10. `src/api/payments/` + `src/api/certificates/` — Monetization
11. `tests/`                        — Integration test suite
12. `scripts/seed.js`               — Demo data
