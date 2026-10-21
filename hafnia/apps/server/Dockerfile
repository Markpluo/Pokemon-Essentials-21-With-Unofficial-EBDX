# Copper & Current game server. Build from the hafnia/ folder:
#   docker build -f apps/server/Dockerfile -t copper-current-server .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages packages
COPY packs packs
COPY apps/server apps/server
COPY apps/client/package.json apps/client/package.json
RUN npm ci --ignore-scripts && npm -w @hafnia/server run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Only the runtime libraries: the game code is bundled into dist/server.mjs.
RUN echo '{"private":true}' > package.json && npm install --omit=dev --ignore-scripts --no-package-lock jose@6.2.13 pg@8.23.1 ws@8.22.0 @pkmn/sim@0.10.11
COPY --from=build /app/apps/server/dist ./dist
COPY apps/server/db ./db
EXPOSE 8080
USER node
CMD ["node", "dist/server.mjs"]
