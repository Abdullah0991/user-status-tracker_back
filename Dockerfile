# Stage 1: Build
FROM node:20 AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TS -> JS
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Install only what Prisma really needs
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY prisma ./prisma

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Migrate -> Seed -> Start server
CMD sh -c "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"
