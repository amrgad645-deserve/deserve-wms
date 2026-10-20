FROM node:20
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev
RUN npm rebuild better-sqlite3 --build-from-source

COPY .next/standalone/server.js ./server.js
COPY .next/standalone/.next ./.next
COPY .next/static ./.next/static
COPY src ./src
COPY deserve_wms.db ./deserve_wms.db

RUN chmod -R 777 /app

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "server.js"]
