# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: Production image ----
FROM node:22-alpine
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY tsconfig.json ./

# Render provides PORT via env var
ENV NODE_ENV=production
EXPOSE 5000

CMD ["npx", "tsx", "src/index.ts"]
