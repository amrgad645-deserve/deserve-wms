FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY .next/standalone/server.js ./server.js
COPY .next/standalone/.next ./.next
COPY .next/static ./.next/static
COPY src/data/seed_products.json ./src/data/seed_products.json
COPY deserve_wms.db ./deserve_wms.db

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "server.js"]
