FROM node:lts-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS dev

RUN npm ci

COPY . .
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "run", "dev"]

FROM base AS production

RUN npm ci --omit=dev

COPY . .
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
