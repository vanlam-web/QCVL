FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
ARG VITE_API_BASE_URL=http://100.84.228.125:3200
ARG VITE_APP_ENV=nas-dev
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
COPY . .
RUN npm run build:all

FROM node:22-alpine AS runner
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.source="qcvl" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.created=$BUILD_DATE
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV STATIC_ROOT=/app/dist
COPY package*.json ./
RUN npm ci --omit=dev && addgroup -S qcvl && adduser -S qcvl -G qcvl
COPY --from=build --chown=qcvl:qcvl /app/dist ./dist
COPY --from=build --chown=qcvl:qcvl /app/dist-server ./dist-server
COPY --from=build --chown=qcvl:qcvl /app/database/migrations ./database/migrations
COPY --from=build --chown=qcvl:qcvl /app/scripts/db-migrate.mjs ./scripts/db-migrate.mjs
USER qcvl
EXPOSE 3100
CMD ["node", "dist-server/index.js"]