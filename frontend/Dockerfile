# --- build the React app ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json .npmrc* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# --- serve with nginx ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.container.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
