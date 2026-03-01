# DecoMe — Technical Guide

## Architecture Overview

3-layer architecture:
1. **Presentation** — Next.js 14 (TypeScript + Tailwind CSS)
2. **Business Logic** — FastAPI (Python 3.12) + Pydantic + SQLAlchemy 2.0 async
3. **Data Access** — PostgreSQL 16, Redis 7, Docker volumes

## Services

| Service | Image / Base | Port | Purpose |
|---------|-------------|------|---------|
| `db` | postgres:16-alpine | 5432 | PostgreSQL database |
| `redis` | redis:7-alpine | 6379 | Job queue (Phase 4+) |
| `api` | python:3.12-slim | 8000 | FastAPI backend |
| `web` | node:20-alpine | 3000 | Next.js frontend |

## Quick Start

```bash
make up       # Build and start all containers
make down     # Stop all containers
make test     # Run all tests inside containers
make logs     # Tail all container logs
make seed     # Re-seed database
make migrate  # Run pending Alembic migrations
```

## Default Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@decome.app | Admin123! | admin |

**Change the admin password immediately after first login in any non-dev environment.**

## Environment Variables (API)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://decome:decome_dev_pass@db:5432/decome` | PostgreSQL connection |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection |
| `SECRET_KEY` | `dev-secret-key-change-in-production-must-be-32chars` | JWT signing key (change in prod!) |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_EXPIRY_MINUTES` | `60` | Access token lifetime |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `UPLOAD_DIR` | `/app/uploads` | Directory for branding assets |

## Environment Variables (Web)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base URL (used by the browser) |
| `BACKEND_URL` | `http://api:8000` | API base URL for server-side Next.js rewrites (internal Docker network) |
| `WATCHPACK_POLLING` | `true` | Enable polling for file watching (required on Windows) |

## Database Schema (Phase 1)

- **roles**: id, name, description, created_at
- **users**: id (UUID), email, hashed_password, full_name, role_id, is_active, totp_secret (encrypted), totp_enabled, password_reset_token, password_reset_expires, created_at, updated_at
- **branding_config**: id, logo_light_path, logo_dark_path, favicon_path, updated_by, updated_at
- **audit_logs**: id (bigint), user_id, action, resource_type, resource_id, details (JSONB), ip_address, user_agent, created_at

## API Endpoints (Phase 1)

### Auth (`/api/auth/`)
- `POST /login` — Email/password → JWT (or temp_token if 2FA enabled)
- `POST /login/2fa` — TOTP code + temp_token → JWT
- `POST /register` — Create user (Admin only)
- `POST /password-reset/request` — Request password reset email
- `POST /password-reset/confirm` — Reset password with token
- `POST /2fa/setup` — Generate TOTP secret + QR URI
- `POST /2fa/enable` — Verify first code, enable 2FA
- `POST /2fa/disable` — Verify code, disable 2FA
- `GET  /me` — Current user profile
- `POST /logout` — Log out (audit trail)

### Users (`/api/users/`) — Admin only
- `GET    /` — List all users (paginated)
- `GET    /{id}` — Get user by ID
- `PATCH  /{id}` — Update user (name, role, active status)
- `DELETE /{id}` — Soft-delete user (deactivate)

### Branding (`/api/branding/`)
- `GET    /` — Get current branding config (public)
- `POST   /logo?variant=light|dark` — Upload logo (Admin)
- `POST   /favicon` — Upload favicon (Admin)
- `DELETE /logo?variant=light|dark` — Delete logo (Admin)
- `DELETE /favicon` — Delete favicon (Admin)
- `GET    /assets/{filename}` — Serve branding asset (public)

### Health
- `GET /api/health` — Service health check

## Security

- **Passwords**: bcrypt (passlib), minimum 8 chars + upper + lower + digit + special
- **JWT**: HS256, 60-minute access tokens, 5-minute temp tokens for 2FA
- **2FA**: TOTP (pyotp), secrets encrypted with Fernet before storage
- **RBAC**: `require_roles()` FastAPI dependency on every protected endpoint
- **Audit**: Every user action writes to `audit_logs` table

## Git Flow

- `main` — stable releases only
- `develop` — active development
- Feature branches from `develop`, merged via PR
- Phase completion: merge `develop` → `main` after acceptance

## Running Tests

Tests run **inside containers** for parity with production:

```bash
make test          # All tests
make test-api      # Backend tests only (pytest)
make test-web      # Frontend tests only (jest)
```

Backend: 35 pytest tests across auth, RBAC, branding, and audit modules.
Frontend: 15 Jest + RTL tests covering ThemeToggle, AuthGuard, RoleGuard, login page, and API interceptor.

Backend test database: `decome_test` (created automatically).

## File Watching on Windows

Docker Desktop on Windows uses WSL2. File change events from the host filesystem may not propagate reliably. Both services are configured to use polling:

- **Next.js**: `WATCHPACK_POLLING=true` environment variable
- **uvicorn**: `--reload-dir /app/app` flag (scoped to the app directory)

## Adding a New Alembic Migration

```bash
make migration msg="add my new table"
make migrate
```
