FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} PORT=3000
LABEL org.opencontainers.image.title="kubeshop-api" \
      org.opencontainers.image.description="API da loja KubeShop (Node.js/Express + MongoDB)"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
