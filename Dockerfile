# ---- Builder Stage ----
FROM node:24.5.0-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# ---- Production Stage ----
FROM node:24.5.0-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

RUN npm install --omit=dev --ignore-scripts

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]