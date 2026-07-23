# Build React app
FROM node:18-alpine as build

WORKDIR /app
v bigger samll
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL
ARG REACT_APP_USE_TEST_TELEGRAM_ID=false

COPY package*.json ./
RUN npm install

COPY . .

RUN if [ -n "$REACT_APP_API_URL" ] || [ -n "$REACT_APP_SOCKET_URL" ]; then \
      printf "REACT_APP_API_URL=%s\nREACT_APP_SOCKET_URL=%s\nREACT_APP_USE_TEST_TELEGRAM_ID=%s\n" "$REACT_APP_API_URL" "$REACT_APP_SOCKET_URL" "$REACT_APP_USE_TEST_TELEGRAM_ID" > .env.production.local; \
    fi && npm run build

# Serve with nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
