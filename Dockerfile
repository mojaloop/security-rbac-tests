FROM node:16-alpine3.15 as builder
USER root

WORKDIR /opt/test

RUN apk add --no-cache -t build-dependencies git make gcc g++ python3 libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/test/
RUN npm ci

# check in .dockerignore what is skipped during copy
COPY . .

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

COPY --chown=user1 --from=builder /opt/test .

# RUN npm prune --production

EXPOSE 3001
CMD ["npm", "run", "test"]