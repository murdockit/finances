FROM node:20-alpine AS build

WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json ./
COPY tsconfig.json tsconfig.json
COPY tsconfig.node.json tsconfig.node.json
COPY vite.config.ts vite.config.ts
RUN npm install
COPY index.html index.html
COPY src src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY package.json /app/package.json
EXPOSE 5173
CMD ["./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
