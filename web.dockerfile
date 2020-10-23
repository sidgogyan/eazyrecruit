##DockerFile
FROM node:10.22.1-stretch AS build

# Setting working directory. All the path will be relative to WORKDIR
WORKDIR /usr/src/app

# Installing dependencies
COPY ./web/package*.json ./
RUN npm install

# Copying source files
COPY ./web .

# Building app
RUN npm run build

##DockerFile
FROM node:10.22.1-stretch

# Setting working directory. All the path will be relative to WORKDIR
WORKDIR /usr/src/app

# Installing dependencies
COPY ./core/package*.json ./
RUN npm install

# Copying source files
COPY ./core .

COPY --from=build /usr/src/core/admin /usr/src/app/admin

EXPOSE 8082

CMD [ "npm", "start" ]
