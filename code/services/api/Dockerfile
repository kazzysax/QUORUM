FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV DB_PATH=/data/quorum.db
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "src/server.js"]
