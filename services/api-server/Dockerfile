FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src ./src

EXPOSE 8094

CMD ["npm", "run", "dev"]
