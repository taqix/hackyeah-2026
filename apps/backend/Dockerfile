FROM node:22-bookworm-slim AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace=@hackyeah/backend --include=dev --ignore-scripts

COPY apps/backend/nest-cli.json apps/backend/tsconfig*.json apps/backend/
COPY apps/backend/src apps/backend/src
RUN npm run build --workspace=@hackyeah/backend

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --omit=dev --workspace=@hackyeah/backend --ignore-scripts \
    && npm cache clean --force

COPY --from=build /workspace/apps/backend/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
