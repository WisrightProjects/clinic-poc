FROM node:20-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Migrations run on boot (server.js) before app.listen.
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/server.js"]
