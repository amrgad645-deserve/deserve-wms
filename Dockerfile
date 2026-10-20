FROM node:20
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

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
