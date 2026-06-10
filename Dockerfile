# Build stage
FROM node:20-alpine3.21 AS build
WORKDIR /app

COPY package*.json ./
RUN apk --no-cache upgrade \
	&& npm ci

COPY . .
RUN npm run build

# Runtime stage (non-root nginx image)
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

USER root
RUN apk --no-cache upgrade

ARG APP=playfield

# Copie tout le dist (assets partagés + index.html des 3 apps)
COPY --from=build /app/dist ./

# Remonte l'index.html de l'app demandée à la racine, retire les autres apps
RUN mv ./apps/${APP}/index.html ./index.html \
	&& rm -rf ./apps

COPY nginx/${APP}.conf /etc/nginx/conf.d/default.conf

USER 101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
