FROM nodered/node-red:4.1.3-18

RUN mkdir -p module/lib
COPY package*.json module/
COPY lib module/lib/
RUN npm install ./module
