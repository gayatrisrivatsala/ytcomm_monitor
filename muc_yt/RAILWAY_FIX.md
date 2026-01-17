# Railway Deployment Fix

## If build fails, check Railway logs for specific error

Common issues:
1. **Python version** - Railway auto-detects, but you can specify in `runtime.txt`
2. **Package conflicts** - Check exact error in Railway logs
3. **Missing dependencies** - All packages in requirements.txt

## Troubleshooting Steps:

### 1. Check Railway Logs
- Go to Railway Dashboard → Your Service → Deployments → Click latest
- Look at build logs for exact error

### 2. Verify requirements.txt
Make sure all dependencies are listed:
```
fastapi==0.104.1
uvicorn==0.24.0
requests==2.31.0
python-dotenv==1.0.0
pydantic==2.5.2
```

### 3. Check Root Directory
- Railway Settings → Root Directory should be: `muc_yt`

### 4. Verify Start Command
- Should be: `uvicorn api_server:app --host 0.0.0.0 --port $PORT`
- Or Railway will use `Procfile` if present

### 5. Common Fixes:
- If pydantic error: Use pydantic==2.5.2 (compatible with fastapi 0.104.1)
- If uvicorn error: Make sure you have `uvicorn[standard]` or just `uvicorn`
- If Python version: Add `runtime.txt` with `python-3.11.7`

### 6. Try Minimal requirements.txt (if still failing):
```
fastapi
uvicorn[standard]
requests
python-dotenv
```

Then Railway will install latest compatible versions.
