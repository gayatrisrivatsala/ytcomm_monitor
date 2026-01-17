# Deployment Guide

## 🔐 Securing Your API Key

### Step 1: Create Environment Files

**For Python API Server (muc_yt folder):**
1. Create `.env` file in `muc_yt/` folder (already created, but check it exists)
2. Add your API key:
   ```
   MINO_API_KEY=your_api_key_here
   ```
3. Install python-dotenv: `pip install python-dotenv`

**For Next.js Frontend (ytcomm_monitor folder):**
1. Create `.env.local` file in `ytcomm_monitor/` folder
2. Add environment variables:
   ```
   MINO_API_KEY=your_api_key_here
   NEXT_PUBLIC_API_URL=/api
   ```
   (For local development, use `NEXT_PUBLIC_API_URL=http://localhost:8000`)

### Step 2: Verify .gitignore

Make sure `.env` and `.env.local` files are in `.gitignore` (they already are ✅)

---

## 🚀 Deploying to Vercel

### Option 1: Deploy Everything to Vercel (Recommended)

1. **Push to GitHub:**
   ```bash
   cd "ytcomm_monitor"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Set Root Directory to `ytcomm_monitor`
   - Add Environment Variables:
     - `MINO_API_KEY` = your Mino AI API key
     - `NEXT_PUBLIC_API_URL` = `/api` (for production)
   - Click "Deploy"

3. **Done!** Your app will be live at `https://your-app.vercel.app`

### Option 2: Deploy Python API Separately (If you prefer FastAPI)

**Deploy to Railway:**
1. Go to [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Select your repo, set root directory to `muc_yt`
4. Add environment variable: `MINO_API_KEY`
5. Install dependencies: `pip install -r requirements.txt`
6. Set start command: `uvicorn api_server:app --host 0.0.0.0 --port $PORT`

**Or Deploy to Render:**
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repo
4. Set:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn api_server:app --host 0.0.0.0 --port $PORT`
   - Environment: `MINO_API_KEY`

Then update `NEXT_PUBLIC_API_URL` in Vercel to your Railway/Render URL.

---

## 📝 GitHub Setup

### Initial Setup:

```bash
# Navigate to project root
cd "C:\Users\gayat\muc yt"

# Initialize git (if not already done)
git init

# Create .gitignore in root (if needed)
echo "muc_yt/.env" >> .gitignore
echo "ytcomm_monitor/.env.local" >> .gitignore
echo ".env" >> .gitignore

# Add all files
git add .

# Commit
git commit -m "Initial commit: YouTube Comments Monitor"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Important Notes:

✅ **Protected Files (in .gitignore):**
- `muc_yt/.env` - Contains your API key
- `ytcomm_monitor/.env.local` - Contains your API key
- All `.env*` files

✅ **Safe to Commit:**
- All source code files
- `.env.example` files (template without real keys)
- `requirements.txt`
- `package.json`

---

## 🔧 Local Development

### Run Python API Server:
```bash
cd muc_yt
pip install -r requirements.txt
python api_server.py
```

### Run Next.js Frontend:
```bash
cd ytcomm_monitor
npm install
npm run dev
```

Visit `http://localhost:3000`

---

## ✨ Quick Checklist

- [ ] Create `.env` in `muc_yt/` with `MINO_API_KEY`
- [ ] Create `.env.local` in `ytcomm_monitor/` with `MINO_API_KEY`
- [ ] Verify `.gitignore` includes `.env` files
- [ ] Push to GitHub
- [ ] Deploy to Vercel with environment variables
- [ ] Test the deployed app

---

## 🆘 Troubleshooting

**API Key exposed?**
- Immediately regenerate your API key at Mino AI
- Verify `.env` files are in `.gitignore`
- Never commit `.env` files

**Deployment fails?**
- Check environment variables are set in Vercel
- Verify `MINO_API_KEY` is correct
- Check Vercel logs for errors
