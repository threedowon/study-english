FROM node:24-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs index.html app.js style.css config.js ./
COPY --chown=node:node lib ./lib
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV PORT=5173
ENV DATA_PATH=/app/data/study.sqlite
EXPOSE 5173
CMD ["node", "server.mjs"]
