# docs/44. one image that can talk to postgres over the wire, which is the difference
# between hosting this and renting it.
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
# the supervisor, not the loop: a process that exits should be restarted by policy, not by luck
CMD ["npx", "tsx", "scripts/supervise.ts"]
