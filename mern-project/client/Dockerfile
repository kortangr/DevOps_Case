FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080