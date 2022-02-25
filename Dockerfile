FROM node:16-alpine3.15

USER root

RUN apk add --no-cache -t build-dependencies python3 git make gcc g++  libtool autoconf automake \
    && npm install -g npm\
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

WORKDIR /opt/test

COPY . /opt/test

RUN npm ci --production


# cleanup
RUN apk del build-dependencies

FROM node:16-alpine3.15
WORKDIR /opt/test


# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: user1
RUN adduser -D user1
USER user1

COPY --chown=user1 --from=builder /opt/test

CMD npm run test
