# Deploy Python API to Railway (Recommended for Vercel Hobby)

## Why?
Vercel Hobby plan has a **10-second timeout** for serverless functions, but Mino AI comment extraction takes longer. Deploying the Python API separately gives you full control.

## Quick Deploy to Railway (5 minutes)

### Step 1: Prepare for Railway
Railway will automatically detect Python and install from `requirements.txt`

### Step 2: Deploy
1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `gayatrisrivatsala/ytcomm_monitor`
5. In settings, set:
   - **Root Directory:** `muc_yt`
   - **Start Command:** `uvicorn api_server:app --host 0.0.0.0 --port $PORT`
   - Railway will auto-detect Python and install dependencies

### Step 3: Set Environment Variable
1. Go to Railway project → **Variables** tab
2. Add: `MINO_API_KEY` = `sk-mino-TzDd-n0CMvFC5N4hu45yZO8w6vuebyRO`

### Step 4: Get Your API URL
1. Railway will give you a URL like: `https://your-app.railway.app`
2. Copy this URL

### Step 5: Update Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - `NEXT_PUBLIC_API_URL` = `https://your-app.railway.app`
3. Redeploy

### Step 6: Update Frontend (Optional - Already configured)
The frontend already uses `NEXT_PUBLIC_API_URL`, so it should work automatically!

## Alternative: Deploy to Render

### Step 1: Create Web Service
1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo

### Step 2: Configure
- **Name:** `youtube-comments-api`
- **Root Directory:** `muc_yt`
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn api_server:app --host 0.0.0.0 --port $PORT`

### Step 3: Set Environment Variable
- `MINO_API_KEY` = your API key

### Step 4: Get URL and Update Vercel
- Render gives you: `https://your-app.onrender.com`
- Set `NEXT_PUBLIC_API_URL` in Vercel to this URL

## Free Tier Limits
- **Railway:** $5 credit/month, then pay-as-you-go
- **Render:** Free tier available (may spin down after inactivity)

## Benefits
✅ No timeout limits
✅ Full control over Python environment
✅ Can run background jobs
✅ Better for long-running operations
