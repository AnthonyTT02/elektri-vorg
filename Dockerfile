# ---- Stage 1: зависимости ----
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ---- Stage 2: тесты (опционально в CI) ----
FROM node:18-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

# ---- Stage 3: production образ ----
FROM node:18-alpine AS production
WORKDIR /app

# Копируем только production зависимости
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Запускаем от непривилегированного пользователя
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
