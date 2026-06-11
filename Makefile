.PHONY: dev migrate seed install db

db:
	docker-compose up postgres redis -d

dev: db
	cd backend && npm run dev &
	cd frontend && npm run dev

migrate:
	cd backend && npx prisma migrate dev --name init

seed:
	cd backend && npm run seed

install:
	cd backend && npm install
	cd frontend && npm install
