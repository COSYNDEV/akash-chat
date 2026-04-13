# ---- Base Node ----
FROM node:19-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# ---- Dependencies ----
FROM base AS dependencies
RUN pnpm install --frozen-lockfile
# ---- Build ----
FROM dependencies AS build
COPY . .
# Create a default .env file from example (will be overridden by runtime env)
COPY .env.example .env
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID}
ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_VERSION=${NEXT_PUBLIC_VERSION}
ARG NEXT_PUBLIC_WEBSOCKET_URLS
ENV NEXT_PUBLIC_WEBSOCKET_URLS=${NEXT_PUBLIC_WEBSOCKET_URLS}
RUN pnpm run build
# ---- Production ----
FROM node:19-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.js ./next.config.js
# Expose the port the app will run on
EXPOSE 3000
# Start the application
CMD ["pnpm", "start"]
