# One image for both the web app and the background worker.
# Built by `make image`; started by `make run` via docker-compose.yml.
FROM node:24-alpine

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first so this layer caches across source edits.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
# --ignore-scripts: the postinstall hook is a bash script and Alpine has no bash.
# The prisma client is generated explicitly in the build step below instead.
RUN npm ci --ignore-scripts

COPY . .

# Prisma client + production Next.js build. DATABASE_URL is only a build-time
# placeholder here; the real value is supplied at runtime by docker-compose.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Default command runs the web app. The worker service overrides this.
CMD ["npm", "start"]
