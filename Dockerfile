FROM node:16-alpine3.15

RUN apk add --no-cache -t build-dependencies python3 git make gcc g++  libtool autoconf automake \
    && npm install -g npm\
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

WORKDIR /opt/test

COPY . /opt/test

RUN npm ci --production

CMD npm run test
