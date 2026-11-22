FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY db.js app.js server.js ./
COPY routes ./routes
COPY middleware ./middleware
COPY tests ./tests

EXPOSE 3000
CMD ["npm", "start"]
