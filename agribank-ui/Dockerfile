FROM node:22.23.5-alpine3.24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . ./
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm test && npm run build

FROM node:22.23.5-alpine3.24 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.cjs ./server.cjs
USER node
EXPOSE 3000
CMD ["node", "server.cjs"]
