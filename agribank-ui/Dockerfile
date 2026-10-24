FROM node:lts-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . ./
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:lts-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.cjs ./server.cjs
CMD ["node", "server.cjs"]
