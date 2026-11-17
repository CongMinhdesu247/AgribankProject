FROM node:22.23.5-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
USER node
EXPOSE 5000
CMD ["node", "server.js"]
