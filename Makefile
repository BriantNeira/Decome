.PHONY: up down logs test test-api test-web lint migrate migration seed shell-api shell-web rebuild ps

up:
	bash scripts/dev-up.sh

down:
	bash scripts/dev-down.sh

logs:
	docker compose logs -f

ps:
	docker compose ps

# ── Tests ──────────────────────────────────────────────────────────────────────

test: test-api test-web

test-api:
	docker compose exec api python -m pytest tests/ -v --tb=short

test-web:
	docker compose exec web npm test -- --watchAll=false --passWithNoTests

# ── Linting ────────────────────────────────────────────────────────────────────

lint:
	docker compose exec api python -m ruff check app/
	docker compose exec web npm run lint

# ── Database ───────────────────────────────────────────────────────────────────

migrate:
	docker compose exec api alembic upgrade head

migration:
	@if [ -z "$(msg)" ]; then echo "Usage: make migration msg=\"description\""; exit 1; fi
	docker compose exec api alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec api python -m app.seed

# ── Shell access ───────────────────────────────────────────────────────────────

shell-api:
	docker compose exec api bash

shell-web:
	docker compose exec web sh

shell-db:
	docker compose exec db psql -U decome -d decome

# ── Rebuild ────────────────────────────────────────────────────────────────────

rebuild:
	docker compose up --build -d
