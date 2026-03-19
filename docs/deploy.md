# Deployment Guide - Coolify

This guide explains how to deploy the odoo-web3 application on Coolify.

## Prerequisites

- Coolify instance with Docker support
- Access to your Coolify dashboard
- Git repository hosted on GitHub, GitLab, or similar

## Environment Variables

The application requires the following environment variables:

### Required Variables

- `ENV` - Environment mode: `production` or `sandbox` (default: `sandbox`)

### Monerium Integration

- `MONERIUM_CLIENT_ID` - Monerium OAuth client ID
- `MONERIUM_CLIENT_SECRET` - Monerium OAuth client secret (optional, for server-side auth)

### Odoo Integration (Optional - can be configured via UI)

- `ODOO_URL` - Your Odoo instance URL (e.g., `https://yourcompany.odoo.com`)
- `ODOO_DATABASE` - Odoo database name
- `ODOO_USERNAME` - Odoo username for API access
- `ODOO_PASSWORD` - Odoo password for API access

### Wallet Configuration (Optional)

- `PRIVATE_KEY` - Private key for signing transactions (without 0x prefix)
- `SERVER_WALLET_ADDRESS` - Explicit wallet address (if not using PRIVATE_KEY)

### Open Collective Integration (Optional)

- `OC_API_KEY` - Open Collective API key

### Blockchain Configuration (Optional)

- `CHAIN` - Blockchain network (default: `gnosis`)
- `FROM_BLOCK` - Starting block number for event scanning
- `ETHEREUM_ETHERSCAN_API_KEY` - Etherscan API key for verification

## Deployment Steps

### 1. Create New Application in Coolify

1. Log in to your Coolify dashboard
2. Click on **New Resource** → **Application**
3. Select your Git provider (GitHub, GitLab, etc.)
4. Select the repository containing your odoo-web3 code
5. Choose the branch to deploy (e.g., `main`)

### 2. Configure Build Settings

Coolify will automatically detect the Dockerfile. If not:

1. Go to **Build** settings
2. Set **Build Pack** to `Dockerfile`
3. Ensure **Dockerfile Location** is set to `./Dockerfile` (root directory)

### 3. Configure Environment Variables

1. Go to **Environment Variables** section
2. Add the required environment variables:

```env
ENV=production
MONERIUM_CLIENT_ID=your-monerium-client-id
MONERIUM_CLIENT_SECRET=your-monerium-client-secret
```

Optional variables (if using Odoo):
```env
ODOO_URL=https://yourcompany.odoo.com
ODOO_DATABASE=your-database-name
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password
```

Optional variables (if using wallet signing):
```env
PRIVATE_KEY=your-private-key-without-0x
SERVER_WALLET_ADDRESS=0xYourWalletAddress
```

### 4. Configure Port Mapping

1. Go to **Ports** or **Networking** section
2. The application runs on port **8000** internally
3. Map it to your desired external port (e.g., 80 or 443 for HTTPS)

Example:
- **Container Port**: 8000
- **Public Port**: 80 (or let Coolify auto-assign)

### 5. Configure Domain (Optional but Recommended)

1. Go to **Domains** section
2. Add your custom domain (e.g., `invoices.yourcompany.com`)
3. Enable **HTTPS** (Coolify will automatically provision SSL certificates via Let's Encrypt)

### 6. Deploy

1. Click **Deploy** or **Save & Deploy**
2. Monitor the build logs to ensure successful deployment
3. Once deployed, the application will be available at your configured domain or Coolify-assigned URL

## Post-Deployment

### Access the Application

Visit your domain or the URL provided by Coolify. You should see the application's login/settings page.

### Configure Odoo Connection (if not set via env vars)

If you didn't set Odoo credentials via environment variables:

1. Click on **Settings** in the application
2. Fill in your Odoo connection details
3. Test the connection

### Configure Monerium

1. Navigate to the Monerium settings page in the app
2. Follow the OAuth flow to connect your Monerium account

## Testing the Deployment

### 1. Local Docker Test (Before Coolify)

To test the Docker image locally before deploying to Coolify:

```bash
# Build the image
docker build -t odoo-web3:test .

# Create a .env file with your variables
# Then run the container
docker run -d \
  --name odoo-web3-test \
  -p 8000:8000 \
  --env-file .env \
  odoo-web3:test

# Check logs
docker logs -f odoo-web3-test

# Test the application
curl http://localhost:8000/

# Clean up
docker stop odoo-web3-test
docker rm odoo-web3-test
```

### 2. Verify Deployment on Coolify

After deployment:

1. **Check Application Logs** in Coolify dashboard
2. **Test Health**: Visit `https://yourdomain.com/` - should show the application UI
3. **Test API Endpoints**:
   - `https://yourdomain.com/api/monerium/config` - Should return Monerium config
   - Other API endpoints as needed

## Troubleshooting

### Build Fails

**Issue**: Docker build fails with native binding errors

**Solution**: The Dockerfile uses `denoland/deno:debian-2.5.6` which includes support for native modules like `@swc/core`. Do not use Alpine-based images.

### Application Not Starting

**Check**:
1. Review logs in Coolify dashboard
2. Ensure all required environment variables are set
3. Verify port 8000 is correctly mapped

### CORS Issues

If you encounter CORS issues:
- Ensure your domain is correctly configured
- Check that HTTPS is enabled if accessing from a secure context

### Database Connection Errors (Odoo)

**Check**:
1. Odoo credentials are correct
2. Odoo instance is accessible from your Coolify server
3. Database name matches your Odoo instance

## Updating the Application

### Deploy New Version

1. Push changes to your Git repository
2. In Coolify, click **Redeploy** or trigger a webhook
3. Coolify will automatically rebuild and redeploy

### Manual Restart

If you need to restart without rebuilding:
1. Go to your application in Coolify
2. Click **Restart**

## Security Considerations

- **Private Keys**: Store sensitive keys (like `PRIVATE_KEY`) in Coolify's environment variables, never commit them to Git
- **HTTPS**: Always enable HTTPS for production deployments
- **Secrets Rotation**: Regularly rotate API keys and credentials
- **Access Control**: Limit access to your Coolify instance

## Additional Resources

- [Coolify Documentation](https://coolify.io/docs)
- [Deno Documentation](https://deno.land/)
- [Monerium API Docs](https://monerium.dev/)
- [Odoo API Reference](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)

## Support

If you encounter issues:
1. Check the application logs in Coolify
2. Review this documentation
3. Check the GitHub repository issues
4. Contact your system administrator
