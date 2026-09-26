SHELL := /bin/bash

.PHONY: help install laptop-install infra-up infra-down infra-restart lean-up lean-down lean-logs db-push db-studio dev worker build start lint test deploy-web deploy-preview deploy-worker-note

help:
	@echo "Available targets:"
	@echo "  make install            Install npm dependencies"
	@echo "  make laptop-install     One-command local setup for laptops"
	@echo "  make infra-up           Start local Postgres + Redis with Docker"
	@echo "  make infra-down         Stop local Postgres + Redis"
	@echo "  make infra-restart      Restart local Postgres + Redis"
	@echo "  make lean-up            Build + start the local Lean 4 + Mathlib checker (multi-GB image)"
	@echo "  make lean-down          Stop the Lean checker"
	@echo "  make lean-logs          Tail the Lean checker logs"
	@echo "  make db-push            Push Prisma schema to current DATABASE_URL"
	@echo "  make db-studio          Open Prisma Studio"
	@echo "  make dev                Start Next.js dev server"
	@echo "  make worker             Start background worker"
	@echo "  make build              Build Next.js app"
	@echo "  make start              Start production Next.js server"
	@echo "  make lint               Run lint checks"
	@echo "  make test               Placeholder (no tests configured)"
	@echo "  make deploy-preview     Deploy preview to Vercel"
	@echo "  make deploy-web         Deploy production web app to Vercel"
	@echo "  make deploy-worker-note Print worker deployment reminder"

install:
	npm install

laptop-install:
	bash scripts/laptop-install.sh

infra-up:
	docker-compose up -d

infra-down:
	docker-compose down

infra-restart:
	docker-compose down
	docker-compose up -d

lean-up:
	docker-compose --profile lean up -d --build lean-checker

lean-down:
	docker-compose --profile lean stop lean-checker

lean-logs:
	docker-compose --profile lean logs -f lean-checker

db-push:
	npm run db:push

db-studio:
	npm run db:studio

dev:
	npm run dev

worker:
	npm run worker

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

test:
	@echo "No automated test suite configured for this repository."

deploy-preview:
	npx vercel --yes

deploy-web:
	npx vercel --prod --yes

deploy-worker-note:
	@echo "Worker does NOT run on Vercel serverless by default."
	@echo "Deploy worker separately (e.g., Railway/Render) with command: npm run worker"
	@echo "Worker env vars must include: DATABASE_URL, REDIS_URL, GROQ_API_KEY"
