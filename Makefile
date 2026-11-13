.PHONY: help install lint test build up down seed backup restore smoke

SHELL := /bin/bash

help: ## Show this help message
	@echo "Pharmacy Inventory API — Available Commands:"
	@echo ""
	@echo "  make help         Show available commands"
	@echo "  make install      Install backend and frontend dependencies"
	@echo "  make lint         Run linter and formatter checks"
	@echo "  make test         Run unit, integration and concurrency tests"
	@echo "  make build        Build Docker images"
	@echo "  make up           Start docker-compose stack (db, api, web)"
	@echo "  make down         Stop docker-compose stack"
	@echo "  make seed         Seed database with synthetic data"
	@echo "  make backup       Trigger database backup drill"
	@echo "  make restore      Trigger database restore drill"
	@echo "  make smoke        Run smoke tests"
	@echo ""

install: ## Install dependencies
	cd backend && npm ci
	cd frontend && npm ci

lint: ## Run linter and code style checks
	cd backend && npm run lint
	cd frontend && npm run lint

test: ## Run test suite
	cd backend && npm test

build: ## Build docker images
	docker-compose -f deploy/docker-compose.yml build

up: ## Start docker-compose stack
	docker-compose -f deploy/docker-compose.yml up -d

down: ## Stop docker-compose stack
	docker-compose -f deploy/docker-compose.yml down

seed: ## Seed database
	cd backend && npm run seed

backup: ## Run backup script
	bash scripts/backup.sh

restore: ## Run restore script
	bash scripts/restore.sh

smoke: ## Run smoke tests
	bash scripts/smoke-test.sh

