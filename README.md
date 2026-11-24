# ReachInbox – Production-Grade Full-Stack Email Job Scheduler

A production-grade, distributed email job scheduler built for the **ReachInbox Software Development Intern Assignment by Outbox Labs**.

The system features real-time delayed job scheduling, Redis-backed atomic distributed rate-limiting, minimum send delays, multi-sender management, crash recovery reconciliation, Ethereal SMTP test delivery with live preview URLs, Elasticsearch full-text search, live Bull Board metrics, and Slack OAuth with automated rate-limit notification webhooks.

---

## 🏗️ Architecture Overview

The system is structured as a modular TypeScript monorepo containing a high-performance backend, an independent background worker service, and a modern React SaaS frontend.

```
ReachInbox Monorepo
│
├── backend/
│   ├── src/
│   │   ├── config/          # Environment validation, Prisma, Redis setup
│   │   ├── controllers/     # Auth, Email, Sender, Slack, Queue controllers
│   │   ├── integrations/    # Google OAuth, Slack Web API, Nodemailer/Ethereal, Elasticsearch
│   │   ├── middlewares/     # JWT authentication, role guards, error handling
│   │   ├── queues/          # BullMQ queue definitions
│   │   ├── schedulers/      # EmailScheduler, DistributedRateLimiter, Reconciler
│   │   ├── workers/         # Background email processing worker & lifecycle
│   │   ├── routes/          # Express route definitions
│   │   ├── utils/           # AES-256 encryption, Pino structured logger
│   │   └── validators/      # Zod validation schemas
│   ├── prisma/              # PostgreSQL schema & migrations
│   ├── tests/               # Unit, integration, and load test scripts
│   └── Dockerfile / Dockerfile.worker
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, StatCard, ComposeModal (CSV/TXT parser)
│   │   ├── pages/           # Dashboard, ScheduledEmails, SentEmails, Login
│   │   ├── services/        # Axios API clients (authApi, emailApi, slackApi)
│   │   ├── context/         # AuthContext
│   │   └── types/           # TypeScript domain interfaces
│   └── Dockerfile / nginx.conf
│
├── docker-compose.yml       # PostgreSQL, Redis, Elasticsearch, API, Worker, Frontend
└── README.md
```

---

## ⚡ Key Highlights & Core Features

### 1. Persistent Delayed Email Scheduling (BullMQ + Redis)
- **Zero Cron**: Uses BullMQ delayed jobs (`{ delay: targetTime - now }`). No OS-level cron or `node-cron`.
- **Individual Job Tracking**: When a user inputs 1,000 recipients, the system calculates individual staggered delivery times and enqueues **1,000 independent BullMQ jobs** with deterministic IDs (`email_<record_id>`).
- **PostgreSQL Source of Truth**: Every job is created in PostgreSQL first with status `scheduled` before reaching BullMQ.

### 2. Distributed Hourly Rate Limiting
- Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER=200`.
- Implemented with **Redis atomic Lua scripts** evaluated per sender and UTC hour window (`ratelimit:sender:{senderId}:{YYYY-MM-DDTHH}`).
- **Zero Job Dropping**: When a sender hits 200 emails in the hour, subsequent emails are not failed. The system calculates the milliseconds remaining until the next UTC hour window (`getMsUntilNextHour()`), and automatically reschedules the job as a delayed BullMQ job.

### 3. Minimum Delay Between Email Sends
- Configurable via `MIN_DELAY_BETWEEN_EMAILS_MS=2000` (2 seconds default).
- Redis-coordinated timestamp tracking prevents workers from overwhelming SMTP gateways, safely applied across multiple parallel workers.

### 4. Restart Recovery & Crash Reconciliation
- **Redis AOF**: Configured with `appendonly yes` in Docker.
- **Idempotent Reconciliation**: On startup, `reconcileJobs()` queries PostgreSQL for any email in `scheduled` or `processing` status. It queries BullMQ to verify if the job exists; if missing due to a restart or queue outage, it safely re-enqueues the job without creating duplicates.
- **Atomic State Leases**: Uses conditional updates (`UPDATE "EmailJob" SET status='processing' WHERE id=... AND status IN ('scheduled', 'failed')`) to ensure multiple workers never send duplicate emails.

### 5. Multi-Sender Management & AES-256 Token Encryption
- Users can add multiple custom SMTP profiles or use the auto-configured Ethereal SMTP test account.
- Passwords and OAuth access tokens are encrypted at rest using `AES-256-GCM` with initialization vectors (`IV`) and authentication tags.

### 6. Real Slack OAuth & Hourly Rate-Limit Alerts
- Live OAuth flow (`/api/slack/connect`, `/api/slack/callback`).
- When a sender reaches their hourly rate limit, an alert is dispatched to the user's connected Slack channel:
  ```
  ⚠️ Email Rate Limit Reached
  Sender: user@domain.com
  Hourly limit: 200 emails
  Window: 2026-11-25T14
  Action: Rescheduled to next hour
  ```
- Graceful degradation: If Slack is not connected or fails, the email worker logs the event and continues job execution smoothly.

### 7. Nodemailer with Ethereal SMTP Test Provider
- Dispatches emails through Ethereal SMTP.
- Automatically generates an active Ethereal account if credentials are not pre-supplied.
- Records the **Ethereal preview URL** in PostgreSQL and presents a direct clickable link in the frontend "Sent Emails" table.

### 8. Full-Text Search with Elasticsearch (With PostgreSQL Fallback)
- Synchronizes email jobs to the `reachinbox_emails` Elasticsearch index upon creation and status changes.
- Supports fuzzy and full-text search across subject, body, sender, and recipient.
- Resilient fallback: If Elasticsearch is offline or starting up, searches seamlessly fall back to PostgreSQL `ILIKE` queries.

### 9. Bull Board Real-Time Queue Monitor
- Real-time Bull Board dashboard hosted at `/admin/queues`.
- Monitors active, waiting, delayed, completed, and failed jobs.

### 10. Frontend Architecture (Figma-Compliant)
- Built with React, Vite, Tailwind CSS, Lucide icons, and Recharts.
- **File Uploader**: Parses `.csv` and `.txt` files with `PapaParse`, automatically extracts and validates RFC-compliant email addresses, detects and removes duplicates, and displays recipient counts.
- **Real Backend APIs**: No mocked state or hardcoded numbers. All statistics, tables, and actions connect directly to Express endpoints with TanStack Query auto-refreshing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL (or run via Docker)
- Redis (or run via Docker)
- Elasticsearch 8.x (optional for search, Docker provided)

---

### Option A: Running with Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/0123-hamn/Outbox_assingment.git reachinbox
   cd reachinbox
   ```

2. Configure environment variables:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Launch all services with Docker Compose:
   ```bash
   docker compose up --build
   ```

4. Access the applications:
   - **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:5000](http://localhost:5000)
   - **Bull Board Queue Monitor**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
   - **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Option B: Running Locally

#### 1. Setup Backend
```bash
cd backend
npm install
cp .env.example .env

# Generate Prisma Client & Migrate Database
npx prisma generate
npx prisma migrate dev --name init

# Start API Server (Runs on port 5000)
npm run dev

# In a separate terminal, start the Background Worker:
npm run worker
```

#### 2. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## 🧪 Testing

### Backend Unit & Integration Tests
```bash
cd backend
npm run test
```

### High-Volume Load & Concurrency Test (1,000 Jobs)
To verify scheduler throughput, Redis atomic rate limiting, and delayed job generation under load:
```bash
cd backend
npm run load-test
```

### Frontend Tests
```bash
cd frontend
npm run test
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 redirect |
| `GET` | `/api/auth/google/callback` | OAuth callback handler |
| `GET` | `/api/auth/me` | Returns authenticated user details |
| `POST` | `/api/auth/logout` | Clears authentication session cookie |
| `POST` | `/api/auth/dev-login` | Quick development login for testing |

### Email Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/emails/schedule` | Schedules a new email campaign |
| `GET` | `/api/emails/scheduled` | Paginated list of scheduled/processing emails |
| `GET` | `/api/emails/sent` | Paginated list of sent & failed emails |
| `GET` | `/api/emails/search` | Search emails via Elasticsearch or DB fallback |
| `GET` | `/api/emails/stats` | Aggregated dashboard statistics |
| `POST` | `/api/emails/:id/cancel` | Cancels a queued email job |

### Sender Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/senders` | List email sender profiles for authenticated user |
| `POST` | `/api/senders` | Add a custom sender with optional SMTP config |
| `PATCH` | `/api/senders/:id` | Update sender configuration |
| `DELETE` | `/api/senders/:id` | Remove a sender profile |

### Slack Integration
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/slack/connect` | Initiates Slack OAuth connection |
| `GET` | `/api/slack/callback` | Slack OAuth authorization callback |
| `GET` | `/api/slack/status` | Returns current Slack integration status |
| `POST` | `/api/slack/disconnect` | Disconnects Slack workspace |

---

## 🛡️ Assignment Requirement Compliance

| Requirement | Implementation Detail | Status |
|---|---|---|
| **No Cron Jobs** | BullMQ delayed jobs with calculated timestamps | ✅ Fully Implemented |
| **Separate Worker** | Dedicated background worker (`src/workers/index.ts`) | ✅ Fully Implemented |
| **Distributed Rate Limiting** | Redis atomic Lua script windowed counters | ✅ Fully Implemented |
| **Rate Limit Rescheduling** | Jobs moved to next hour window, preserving ordering | ✅ Fully Implemented |
| **Minimum Delay** | Redis timestamp coordination (`MIN_DELAY_BETWEEN_EMAILS_MS`) | ✅ Fully Implemented |
| **Ethereal SMTP Delivery** | Live Nodemailer delivery with test preview URLs | ✅ Fully Implemented |
| **Crash Recovery** | Redis AOF + PostgreSQL reconciliation on startup | ✅ Fully Implemented |
| **Duplicate Prevention** | Atomic state leases (`UPDATE ... WHERE status='scheduled'`) | ✅ Fully Implemented |
| **Google OAuth 2.0** | Secure OAuth 2.0 flow with HttpOnly cookies | ✅ Fully Implemented |
| **Slack Integration** | Real Slack OAuth + Rate limit alerting | ✅ Fully Implemented |
| **Elasticsearch** | Email indexing + multi-field query with DB fallback | ✅ Fully Implemented |
| **Bull Board Dashboard** | Real-time queue visualizer at `/admin/queues` | ✅ Fully Implemented |
| **CSV/TXT Parsing** | Client-side PapaParse extraction & validation | ✅ Fully Implemented |
| **1000+ Load Testing** | Repeatable load test script (`tests/loadTest.ts`) | ✅ Fully Implemented |

---

## 👥 GitHub Collaborators

Collaborators requested for repository access:
- `Mitrajit`
- `Yadav036`

*To grant access via GitHub CLI or web interface:*
```bash
gh repo collaborator add Mitrajit
gh repo collaborator add Yadav036
```
