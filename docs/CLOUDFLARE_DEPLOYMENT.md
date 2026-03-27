# Cloudflare Pages Deployment Guide

This guide explains how to deploy the Who Owns What frontend to **Cloudflare Pages** while running the backend on your own server.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Cloudflare Pages  │ ◄─────► │   Your Server        │
│   (React Frontend)  │  CORS   │   (Django Backend)   │
│   who-owns-what     │         │   IP:PORT            │
└─────────────────────┘         └──────────────────────┘
```

## Prerequisites

1. **Cloudflare Account** with Pages access
2. **Your own server** with:
   - Public IP address
   - Python 3.11+ installed
   - PostgreSQL database
   - Port 8000 (or your choice) open

## Step 1: Configure Your Backend Server

### 1.1 Update CORS Settings

The backend is already configured in `project/settings.py` with Cloudflare Pages domains:

```python
CORS_ALLOWED_ORIGINS = [
    # ... existing origins ...
    "https://who-owns-what.pages.dev",
    "https://*.who-owns-what.pages.dev",
    # Add your custom domain here if you have one:
    # "https://your-domain.com",
]
```

**Important:** Add your server's IP/domain to the list if you want to test locally.

### 1.2 Set Environment Variables on Your Server

Create a `.env` file on your server:

```bash
# Database
DATABASE_URL=postgres://username:password@localhost:5432/dbname

# Security
SECRET_KEY=your-secret-key-here
ALERTS_API_TOKEN=your-alerts-token
SIGNATURE_API_TOKEN=your-signature-token

# Optional
ROLLBAR_ACCESS_TOKEN=your-rollbar-token
```

### 1.3 Run the Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run with gunicorn (production)
gunicorn project.wsgi:application -b 0.0.0.0:8000 --workers 4

# Or use a process manager like systemd or supervisor
```

## Step 2: Deploy Frontend to Cloudflare Pages

### Option A: Using Wrangler CLI

```bash
cd client

# Install dependencies
yarn install

# Set your backend API URL
export REACT_APP_API_BASE_URL=http://YOUR_SERVER_IP:8000

# Build the frontend
yarn build

# Deploy to Cloudflare Pages
npx wrangler pages deploy build --project-name=who-owns-what
```

### Option B: Using Git Integration (Recommended)

1. Push your code to GitHub
2. In Cloudflare Dashboard → Pages → "Create a project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** `yarn build`
   - **Build output directory:** `build`
   - **Root directory:** `client`
5. Add environment variables in Cloudflare Dashboard:
   - `REACT_APP_API_BASE_URL` = `http://YOUR_SERVER_IP:8000`

## Step 3: Configure Environment Variables

### Required Environment Variables for Frontend

Set these in Cloudflare Pages dashboard (Settings → Environment variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | Your backend server URL | `http://123.456.789.0:8000` |
| `REACT_APP_STREETVIEW_API_KEY` | Google StreetView API key | `AIza...` |
| `NODE_VERSION` | Node.js version | `18` |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `REACT_APP_ROLLBAR_ACCESS_TOKEN` | Error tracking |
| `REACT_APP_ALGOLIA_APP_ID` | Search functionality |
| `REACT_APP_MAPBOX_ACCESS_TOKEN` | Maps |

## Step 4: Update CORS on Backend

After your Cloudflare Pages site is deployed, you'll get a URL like:
`https://who-owns-what.pages.dev` or `https://abc123.who-owns-what.pages.dev`

Add this to your backend's `CORS_ALLOWED_ORIGINS` in `project/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    # ... existing origins ...
    "https://abc123.who-owns-what.pages.dev",  # Your actual Pages URL
]
```

Then restart your backend server.

## Step 5: Verify Deployment

1. Visit your Cloudflare Pages URL
2. Open browser console (F12)
3. Try searching for an address
4. Check Network tab - API calls should go to your server IP
5. Check for CORS errors - if present, verify CORS_ALLOWED_ORIGINS

## Troubleshooting

### CORS Errors

If you see errors like:
```
Access to XMLHttpRequest at 'http://YOUR_IP:8000/api/...' from origin 'https://who-owns-what.pages.dev' has been blocked by CORS policy
```

**Solution:**
1. Add your exact Pages URL to `CORS_ALLOWED_ORIGINS`
2. Restart backend server
3. Clear browser cache

### API Not Responding

Check:
1. Server is running: `curl http://YOUR_IP:8000/`
2. Firewall allows port 8000
3. Backend logs for errors

### Build Failures

Common issues:
- Node version mismatch: Set `NODE_VERSION=18` in Cloudflare
- Missing API URL: Ensure `REACT_APP_API_BASE_URL` is set
- Yarn lockfile issues: Delete `node_modules` and `yarn.lock`, reinstall

## Security Considerations

1. **HTTPS:** Consider using HTTPS on your backend (via nginx/traefik + Let's Encrypt)
2. **Firewall:** Only open necessary ports
3. **Secrets:** Never commit `.env` files
4. **CORS:** Be specific with allowed origins, avoid `*` in production

## Production Checklist

- [ ] Backend server secured (firewall, updates)
- [ ] PostgreSQL properly configured
- [ ] CORS origins updated with actual Pages URL
- [ ] Environment variables set in Cloudflare
- [ ] Domain configured (optional, via Cloudflare)
- [ ] SSL/TLS enabled on backend (optional but recommended)
- [ ] Monitoring/logging set up

## Useful Commands

```bash
# Check backend is running
curl http://YOUR_IP:8000/

# Test CORS
curl -H "Origin: https://who-owns-what.pages.dev" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://YOUR_IP:8000/api/

# View Cloudflare Pages logs
npx wrangler pages deployment tail

# Check backend logs
journalctl -u your-backend-service -f
```
