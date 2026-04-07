# Deployment Guide - Coolify

## Prerequisites

- Coolify instance with Docker support
- Git repository hosted on GitHub

## Environment Variables

See [`.env.example`](../.env.example) for all available variables with descriptions.

The only variable that affects runtime behavior is `ENV=production` (defaults to `sandbox`). All Odoo credentials are optional server-side since they can be set via the browser UI (stored in localStorage).

For Monerium enrichment during sync, set `MONERIUM_CLIENT_ID` and `MONERIUM_CLIENT_SECRET`.
For Safe batch payments, set `PRIVATE_KEY_ENCRYPTED` (see below) and `SAFE_ADDRESS`.

## Deployment Steps

### 1. Create Application in Coolify

1. Log in to Coolify
2. **New Resource** > **Application**
3. Select your Git provider and repository
4. Choose the `main` branch

### 2. Configure Build

Coolify auto-detects the Dockerfile. If not:

1. **Build** settings > **Build Pack** = `Dockerfile`
2. **Dockerfile Location** = `./Dockerfile`

### 3. Set Environment Variables

Add at minimum:

```env
ENV=production
```

Add Monerium credentials if using sync enrichment:

```env
MONERIUM_CLIENT_ID=your-client-id
MONERIUM_CLIENT_SECRET=your-client-secret
```

For server-side signing (batch payments), use an encrypted private key:

```bash
# Generate the encrypted value locally
bun run scripts/encrypt-key.ts
```

```env
PRIVATE_KEY_ENCRYPTED=base64salt:base64iv:base64ciphertext:base64tag
```

After deploy, visit the app and submit the passphrase to unlock. The decrypted key lives in memory only until the next restart.

Odoo credentials are optional (users can enter them in the browser):

```env
ODOO_URL=https://yourcompany.odoo.com
ODOO_DATABASE=your-database
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password
```

### 4. Configure Networking

- **Container Port**: 8000
- **Public Port**: 80 (or let Coolify auto-assign)

### 5. Configure Domain (Recommended)

1. Add your domain (e.g. `invoices.yourcompany.com`)
2. Enable HTTPS (Coolify provisions Let's Encrypt certificates automatically)

### 6. Deploy

Click **Deploy** and monitor the build logs.

## Testing Locally with Docker

```bash
# Build the image
docker build -t odoo-web3 .

# Run with your env file
docker run -d --name odoo-web3 -p 8000:8000 --env-file .env odoo-web3

# Verify it starts
docker logs -f odoo-web3
# Should show: "Server running at http://localhost:8000/ in production environment"

# Test
curl http://localhost:8000/

# Clean up
docker stop odoo-web3 && docker rm odoo-web3
```

## Updating

Push to your Git repository and click **Redeploy** in Coolify (or configure a webhook for automatic deploys).

## Troubleshooting

### Build fails with native binding errors

The Dockerfile uses `oven/bun:1-debian` which supports native modules like `@swc/core`. Do not use Alpine-based images.

### Application won't start

1. Check logs in Coolify
2. Ensure `ENV` is set if you want production mode
3. Verify port 8000 is mapped

### Odoo connection errors

1. Verify credentials (either in env vars or entered via the browser UI)
2. Check that the Odoo instance is reachable from the Coolify server

## Security

- The private key is **never stored in plaintext** -- `PRIVATE_KEY_ENCRYPTED` holds an AES-256-GCM encrypted blob, decrypted into memory only after passphrase submission
- Store `MONERIUM_CLIENT_SECRET` in Coolify's environment variables, never in Git
- Always enable HTTPS for production (the unlock passphrase is submitted over HTTPS)
- Odoo credentials entered in the browser stay in localStorage and are sent directly to API calls -- they are not stored server-side
