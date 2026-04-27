# 🔹 Etapa 1: build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 🐳 Construir con configuración de producción (usando .env.production)
RUN NODE_ENV=production npm run build

# 🔹 Etapa 2: servir con nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]