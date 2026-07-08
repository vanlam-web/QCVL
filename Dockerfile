FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
LABEL qcvl.cache-bust="2026-07-08-clean-project"
COPY . .
RUN npm run build:all

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV STATIC_ROOT=/app/dist
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 3100
CMD ["node", "dist-server/index.js"]
