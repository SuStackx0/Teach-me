# Stage 1: build React
FROM node:20-alpine AS builder
WORKDIR /build
COPY react-app/package*.json ./
RUN npm ci --quiet
COPY react-app/ ./
RUN npm run build

# Stage 2: serve with uvicorn
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn anthropic
COPY server.py .
COPY --from=builder /build/dist ./react-app/dist
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
