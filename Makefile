# Coral Club Meet — developer commands.

.PHONY: help up down logs install web dev

help:
	@echo "make up        - build & start LiveKit + backend (Docker, detached)"
	@echo "make down      - stop the Docker stack"
	@echo "make logs      - tail Docker logs"
	@echo "make install   - install frontend dependencies"
	@echo "make web       - run the frontend dev server (Vite, port 5173)"
	@echo "make dev       - up + web (full local stack)"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

install:
	cd frontend && npm install

web: install
	cd frontend && npm run dev

dev: up web
