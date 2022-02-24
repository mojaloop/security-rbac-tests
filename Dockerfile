FROM node:16-alpine3.15

RUN apk --no-cache add g++ gcc libgcc libstdc++ linux-headers make python3
RUN npm install --quiet node-gyp -g

WORKDIR /opt/test

COPY . /opt/test

RUN npm ci --production

CMD npm run test
