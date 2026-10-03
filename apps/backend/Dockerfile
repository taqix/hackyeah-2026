FROM node:22-bookworm-slim AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace=@hackyeah/backend --workspace=@hackyeah/contracts --include=dev --ignore-scripts

COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY packages/contracts/src packages/contracts/src
COPY apps/backend/nest-cli.json apps/backend/tsconfig*.json apps/backend/
COPY apps/backend/src apps/backend/src
RUN npm run build --workspace=@hackyeah/contracts \
    && npm run build --workspace=@hackyeah/backend

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev --workspace=@hackyeah/backend --workspace=@hackyeah/contracts --ignore-scripts \
    && npm cache clean --force

COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=build /workspace/packages/contracts/dist ./packages/contracts/dist
COPY apps/backend/prompts ./apps/backend/prompts

USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/main.js"]
