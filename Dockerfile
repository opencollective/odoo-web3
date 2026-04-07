# Use the official Bun image
FROM oven/bun:1-debian

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app directory
RUN mkdir -p /app

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the project
COPY . .

CMD ["bun", "run", "--env-file=.env", "src/server/index.ts"]
