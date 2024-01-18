# https://www.digitalocean.com/community/tutorials/how-to-build-a-node-js-application-with-docker
FROM node:20-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

# USER node

RUN npm install

COPY --chown=node:node mono_actual.js .

CMD [ "node", "mono_actual.js" ]
