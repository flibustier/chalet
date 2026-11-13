# Chalet in a container: the static app, served by nginx as an unprivileged user on port 8080.
# See docs/self-hosting.md. The app is the same on every platform, so it is built once, on the
# builder's own platform, and only the small nginx stage is per platform.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Optional: a GoatCounter address, to count this copy's own visits there
ARG VITE_GOATCOUNTER=
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
