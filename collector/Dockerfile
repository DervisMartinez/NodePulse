FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package.json index.js ./
USER node
CMD ["node", "index.js"]