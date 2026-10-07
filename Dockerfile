# Production image (Neon/Postgres). Multi-stage keeps the runtime minimal.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Standalone deployment: drop the grok.com platform extension script
ENV VITE_GROK_EXTENSIONS=0
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone deployment: SSR must not inject the grok.com platform script.
ENV VITE_GROK_EXTENSIONS=0
COPY --from=build /app ./
EXPOSE 8080
CMD ["npm", "run", "preview"]
