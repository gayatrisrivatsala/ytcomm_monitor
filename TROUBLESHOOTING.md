# Troubleshooting Guide

## ❌ "No comments found" Error

### Check 1: Environment Variables

**For Local Development:**
1. Create `ytcomm_monitor/.env.local` file:
   ```
   MINO_API_KEY=sk-mino-TzDd-n0CMvFC5N4hu45yZO8w6vuebyRO
   NEXT_PUBLIC_API_URL=/api
   ```
2. Restart your dev server: `npm run dev`

**For Vercel Deployment:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `MINO_API_KEY` = `sk-mino-TzDd-n0CMvFC5N4hu45yZO8w6vuebyRO`
   - `NEXT_PUBLIC_API_URL` = `/api` (optional)
3. Redeploy

### Check 2: API Route is Working

**Test the API endpoint:**
- Visit: `http://localhost:3000/api/extract-comments` (should show `{"message":"API route is working"}`)
- Or: `https://your-app.vercel.app/api/extract-comments`

If you get 404, the route isn't deployed correctly.

### Check 3: Browser Console

Open browser DevTools (F12) → Console tab:
- Look for `API Response:` logs
- Look for `Comments:` logs
- Check for any error messages

### Check 4: Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions tab
2. Click on `extract-comments`
3. Check the logs for:
   - `Event received:` messages
   - `Result JSON:` messages
   - Any error messages

### Check 5: Mino AI Response Format

The API route now has better logging. Check Vercel function logs or local terminal for:
- What `resultJson` actually contains
- Whether it's an array, object, or string

### Common Issues:

1. **API Key Not Set**
   - Error: `MINO_API_KEY not configured`
   - Fix: Set environment variable

2. **Timeout on Vercel Hobby Plan**
   - Error: Function times out after 10 seconds
   - Fix: Upgrade to Pro plan OR reduce timeout in Mino AI payload

3. **Wrong Response Format**
   - Check browser console and Vercel logs
   - The route now handles multiple formats automatically

4. **Streaming Not Completing**
   - The route now buffers SSE properly
   - If still failing, check Mino AI dashboard for job status

## 🔍 Debug Steps

1. **Test locally:**
   ```bash
   cd ytcomm_monitor
   # Create .env.local with MINO_API_KEY
   npm run dev
   ```

2. **Check browser console:**
   - Open DevTools (F12)
   - Try extracting comments
   - Look at Console tab for logs

3. **Check Vercel logs:**
   - Go to Functions → extract-comments → Logs
   - Try again and watch the logs

4. **Test API directly:**
   ```bash
   curl -X POST http://localhost:3000/api/extract-comments \
     -H "Content-Type: application/json" \
     -d '{"video_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
   ```
