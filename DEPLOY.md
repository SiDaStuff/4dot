# Deployment Guide: Cloudflare Pages (Frontend) + Google Cloud Run (Backend)

## Architecture Overview

```
[User Browser]
     |
     |--- HTTPS ---> Cloudflare Pages (React SPA, static assets)
     |                   Domain: yourdomain.com
     |
     |--- HTTPS ---> Google Cloud Run (Express API + SSE)
                       Domain: api.yourdomain.com (or *.run.app)
                       Connects to: Firebase Realtime Database
```

---

## Prerequisites

1. **Google Cloud SDK** installed: https://cloud.google.com/sdk/docs/install
2. **Cloudflare account** with Pages enabled
3. **Firebase project** with Realtime Database and Authentication enabled
4. **Node.js 20+** installed locally

---

## Part 1: Deploy Backend to Google Cloud Run

### Step 1: Set up Google Cloud project

```bash
# Login to Google Cloud
gcloud auth login

# Create a project (or use existing)
gcloud projects create your-project-id --name="4dot Game"
gcloud config set project your-project-id

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 2: Store secrets in Secret Manager

```bash
# Create secrets for sensitive values
echo -n "your-firebase-private-key-content" | \
  gcloud secrets create firebase-private-key --data-file=-

echo -n "your-firebase-client-email" | \
  gcloud secrets create firebase-client-email --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding firebase-private-key \
  --member="serviceAccount:your-project-id@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding firebase-client-email \
  --member="serviceAccount:your-project-id@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy 4dot-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "\
FIREBASE_PROJECT_ID=your-project-id,\
VITE_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com,\
CORS_ORIGINS=https://yourdomain.com,https://yourdomain.pages.dev"
```

**Note**: The `--timeout 3600` is critical for SSE connections. The server sends keepalive pings every 30 seconds to prevent Cloud Run from treating connections as idle.

### Step 4: Get the Cloud Run URL

After deployment, note the service URL:
```
https://4dot-backend-xxxxx-uc.a.run.app
```

You'll need this for the frontend's `VITE_API_URL` environment variable.

### Step 5: (Optional) Set up custom domain for the API

```bash
# Map a custom domain to Cloud Run
gcloud beta run domain-mappings create \
  --service 4dot-backend \
  --domain api.yourdomain.com \
  --region us-central1
```

Then add a CNAME record in Cloudflare DNS:
```
api.yourdomain.com  CNAME  ghs.googlehosted.com
```

---

## Part 2: Deploy Frontend to Cloudflare Pages

### Step 1: Build configuration

In the Cloudflare Pages dashboard (https://dash.cloudflare.com):

1. Click **Create a project** > **Connect to Git**
2. Select your repository
3. Configure build settings:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
   - **Node.js version**: `20`

### Step 2: Set environment variables

In the Cloudflare Pages project settings > **Environment variables**:

| Variable | Value |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your measurement ID |
| `VITE_FIREBASE_DATABASE_URL` | `https://your-project.firebaseio.com` |
| `VITE_API_URL` | `https://4dot-backend-xxxxx-uc.a.run.app` |

**Important**: `VITE_API_URL` must point to your Cloud Run backend URL. Do NOT include a trailing slash.

### Step 3: Deploy

Cloudflare Pages automatically deploys on every push to the main branch. The first deployment will use the build configuration above.

### Step 4: Set up custom domain

1. In Cloudflare Pages > your project > **Custom domains**
2. Add `yourdomain.com` (or any subdomain)
3. Cloudflare will automatically configure DNS

### Step 5: Update CORS origins

After getting your Cloudflare Pages URL, update the backend's `CORS_ORIGINS`:

```bash
gcloud run services update 4dot-backend \
  --region us-central1 \
  --update-env-vars "CORS_ORIGINS=https://yourdomain.com,https://your-project.pages.dev"
```

---

## Part 3: Firebase Configuration

### Step 1: Add authorized domains

In Firebase Console > Authentication > Settings > Authorized domains:
- Add `yourdomain.com`
- Add `your-project.pages.dev`
- Add `localhost` (for local development)

### Step 2: Realtime Database rules

Ensure your `database.rules.json` allows the server (using service account) to read/write while clients only have limited access. The server authenticates as admin, so rules don't restrict it.

### Step 3: (Optional) Set up App Check

For production, enable Firebase App Check to prevent unauthorized API access:
1. Firebase Console > App Check > Get started
2. Register your Cloudflare Pages domain as a web app
3. Enable reCAPTCHA Enterprise provider

---

## Part 4: Local Development Setup

For local development, the architecture runs on localhost:

```bash
# Terminal 1: Start the backend
npm run dev:server
# Runs on http://localhost:3001

# Terminal 2: Start the frontend
npm run dev
# Runs on http://localhost:3000
```

The `.env` file should contain:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
VITE_API_URL=http://localhost:3001

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Part 5: CI/CD Pipeline (Optional)

### Automatic backend deployment on push

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths: ['server/**', 'package.json', 'Dockerfile']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/setup-gcloud@v2
        with:
          service_account_key: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}
      - run: gcloud run deploy 4dot-backend --source . --region us-central1 --allow-unauthenticated
```

Cloudflare Pages auto-deploys on push, so no workflow needed for the frontend.

---

## Part 6: Monitoring & Troubleshooting

### Cloud Run logs
```bash
gcloud run services logs read 4dot-backend --region us-central1
```

### Cloud Run metrics
- Check Cloud Run console for request latency, error rates, and instance counts
- Set up alerts for 5xx errors > 1% or latency > 5s

### Common issues

| Issue | Cause | Fix |
|-------|-------|-----|
| SSE streams stuck "pending" | Service worker intercepting SSE requests | Already fixed in `sw.js` - SSE endpoints bypass the service worker |
| CORS errors | Backend CORS doesn't include frontend domain | Add domain to `CORS_ORIGINS` env var |
| 400 Bad Request on moves | Stale client state | SSE fix resolves this; optimistic updates also help |
| Cloud Run SSE timeouts | Default 60s timeout | Set `--timeout=3600` and server sends keepalive pings every 30s |
| Cloud Run cold starts | Min instances set to 0 | Set `--min-instances=1` to keep a warm instance |

---

## Deployment Checklist

- [ ] Google Cloud project created
- [ ] Firebase project configured (Auth + RTDB)
- [ ] Secrets stored in Secret Manager
- [ ] Backend deployed to Cloud Run with `--timeout=3600`
- [ ] Cloud Run URL noted
- [ ] Frontend deployed to Cloudflare Pages
- [ ] `VITE_API_URL` set to Cloud Run URL
- [ ] Custom domains configured (both frontend and API)
- [ ] `CORS_ORIGINS` updated with frontend domain
- [ ] Firebase Auth authorized domains updated
- [ ] SSE connections verified working (check browser Network tab)
- [ ] Clock countdown verified for both players
- [ ] Piece count display verified
- [ ] Optimistic moves verified (piece appears instantly on click)
