FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node backend ./backend
COPY --chown=node:node frontend ./frontend

USER node

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
