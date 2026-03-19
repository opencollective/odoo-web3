# Use the official Deno image (Debian-based for @swc/core compatibility)
FROM denoland/deno:debian-2.5.6

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app directory
RUN mkdir -p /app

# Set working directory
WORKDIR /app

# Copy your project files
COPY . .

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-ffi", "--env-file=.env", "src/server/index.ts"]