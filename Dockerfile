FROM node:16-alpine3.15

RUN apk add --update python make g++\
   && rm -rf /var/cache/apk/*
   
WORKDIR /opt/test

COPY . /opt/test

RUN npm ci --production

CMD npm run test
