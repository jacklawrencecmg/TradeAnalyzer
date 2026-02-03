# Streamlit Deployment Guide

## Quick Fix: Nothing Works After Deployment

Your Streamlit app needs Supabase credentials to function. Here's how to configure them.

## Local Development Setup

### Step 1: Create Local Secrets File

1. Copy the secrets template:
```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
```

2. The file should contain:
```toml
[supabase]
url = "https://xtkwonklknqzpstedjhg.supabase.co"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0a3dvbmtsa25xenBzdGVkamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzAwODksImV4cCI6MjA4NTcwNjA4OX0.vDASpFYH0NlMVTyyQUSC1wD2o2WhTrAyJ6dwpjiYD9w"
```

3. Run the app:
```bash
streamlit run app.py
```

**Note:** `.streamlit/secrets.toml` is in `.gitignore` and will never be committed to git (for security).

## Deploy to Streamlit Cloud (Recommended)

Streamlit Cloud is the easiest way to deploy your app. It's free for public repos.

### Step 1: Push Your Code to GitHub

```bash
git add .
git commit -m "Prepare Streamlit deployment"
git push origin main
```

### Step 2: Create Streamlit Cloud Account

1. Go to https://share.streamlit.io
2. Sign in with GitHub
3. Authorize Streamlit to access your repositories

### Step 3: Deploy Your App

1. Click "New app" button
2. Select your repository
3. Choose the branch (usually `main`)
4. Set the main file path: `app.py`
5. Click "Advanced settings" before deploying

### Step 4: Configure Secrets

In the "Advanced settings" → "Secrets" section, paste this TOML configuration:

```toml
[supabase]
url = "https://xtkwonklknqzpstedjhg.supabase.co"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0a3dvbmtsa25xenBzdGVkamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzAwODksImV4cCI6MjA4NTcwNjA4OX0.vDASpFYH0NlMVTyyQUSC1wD2o2WhTrAyJ6dwpjiYD9w"
```

### Step 5: Deploy

Click "Deploy!" and wait 2-3 minutes. Your app will be live at:
`https://<your-username>-<repo-name>.streamlit.app`

### Update Secrets Later

If you need to change secrets after deployment:

1. Go to https://share.streamlit.io
2. Click on your app
3. Click "Settings" (gear icon)
4. Click "Secrets" in sidebar
5. Update the TOML configuration
6. Click "Save"
7. App will automatically restart

## Alternative: Deploy to Heroku

If you prefer Heroku:

### Prerequisites

- Heroku account
- Heroku CLI installed

### Deployment Steps

1. Create `Procfile` in project root:
```
web: streamlit run app.py --server.port=$PORT --server.address=0.0.0.0
```

2. Create `setup.sh`:
```bash
mkdir -p ~/.streamlit/

echo "[server]
headless = true
port = $PORT
enableCORS = false
" > ~/.streamlit/config.toml
```

3. Login to Heroku:
```bash
heroku login
```

4. Create Heroku app:
```bash
heroku create your-app-name
```

5. Set environment variables:
```bash
heroku config:set VITE_SUPABASE_URL="https://xtkwonklknqzpstedjhg.supabase.co"
heroku config:set VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

6. Deploy:
```bash
git push heroku main
```

## Alternative: Deploy to Your Own Server

### Using Docker

1. Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

2. Create `.streamlit/secrets.toml` on your server with credentials

3. Build and run:
```bash
docker build -t fantasy-football-analyzer .
docker run -p 8501:8501 fantasy-football-analyzer
```

### Using Traditional Server

1. Install Python 3.11+ on your server

2. Clone repository:
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.streamlit/secrets.toml` with your credentials

5. Run with systemd (create `/etc/systemd/system/streamlit.service`):
```ini
[Unit]
Description=Streamlit Fantasy Football Analyzer
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/app
ExecStart=/usr/local/bin/streamlit run app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

6. Start service:
```bash
sudo systemctl enable streamlit
sudo systemctl start streamlit
```

## Troubleshooting

### Error: "Supabase credentials not configured"

**Cause:** Secrets not set up correctly

**Solution:**
- **Local:** Create `.streamlit/secrets.toml` from template
- **Streamlit Cloud:** Add secrets in app settings
- **Heroku:** Set environment variables with `heroku config:set`

### Error: "ModuleNotFoundError: No module named 'supabase'"

**Cause:** Missing dependencies

**Solution:**
```bash
pip install -r requirements.txt
```

Make sure `requirements.txt` includes:
- `supabase==2.3.4`
- `scikit-learn==1.4.0`
- `numpy==1.26.3`

### Error: "FileNotFoundError: [Errno 2] No such file or directory: '.streamlit/secrets.toml'"

**Cause:** Secrets file doesn't exist locally

**Solution:**
```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
```

### App Runs Locally But Not on Streamlit Cloud

**Causes:**
1. Secrets not configured in Streamlit Cloud
2. Requirements missing from `requirements.txt`
3. Python version mismatch

**Solutions:**
1. Add secrets in Streamlit Cloud app settings
2. Verify all imports are in `requirements.txt`
3. Check Python version (should be 3.11+)

### CORS Errors

**Cause:** Supabase URL mismatch

**Solution:**
1. Verify `supabase.url` matches your Supabase project URL
2. Add your Streamlit Cloud URL to Supabase allowed origins:
   - Go to Supabase Dashboard
   - Settings → API → URL Configuration
   - Add `https://<your-app>.streamlit.app`

### App is Slow

**Cause:** Free tier limitations

**Solutions:**
1. Add caching with `@st.cache_data`:
```python
@st.cache_data(ttl=3600)
def fetch_data():
    # Your data fetching code
    pass
```

2. Upgrade to Streamlit Cloud Pro for better performance
3. Consider deploying to your own server with more resources

## Getting Your Supabase Credentials

If you don't have your Supabase credentials:

1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project
4. Go to Settings → API
5. Copy:
   - **Project URL** → This is your `url`
   - **anon/public key** → This is your `anon_key`

## Security Notes

✓ The anon key is safe to expose publicly (it's designed to be used in frontend apps)
✓ Real security comes from Row Level Security (RLS) policies in Supabase
✓ `.streamlit/secrets.toml` is in `.gitignore` and never committed
✓ Streamlit Cloud secrets are encrypted and secure
✓ Users can only access their own data thanks to RLS policies

## Verification Checklist

After deployment, verify:

- [ ] App loads without errors
- [ ] Can create an account (sign up works)
- [ ] Can log in
- [ ] Can add a Sleeper league
- [ ] Can analyze trades
- [ ] Can save trades
- [ ] Can view saved trades
- [ ] No console errors
- [ ] Works on mobile

## Resources

- [Streamlit Cloud Documentation](https://docs.streamlit.io/streamlit-community-cloud)
- [Streamlit Secrets Management](https://docs.streamlit.io/streamlit-community-cloud/deploy-your-app/secrets-management)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Python Client](https://github.com/supabase-community/supabase-py)

## Summary

**The main issue:** Supabase credentials need to be configured in your deployment environment.

**Quick Solution:**
1. **Streamlit Cloud:** Add secrets in app settings (TOML format)
2. **Local:** Create `.streamlit/secrets.toml` from template
3. **Heroku:** Use `heroku config:set` for environment variables

That's it! Once secrets are configured, everything will work.

## Need Help?

Common issues and fixes:
1. **Forgot secrets**: Check app settings → Secrets (Streamlit Cloud)
2. **Missing dependencies**: Run `pip install -r requirements.txt`
3. **Wrong format**: Secrets must be in TOML format with `[supabase]` section
4. **Typo in keys**: Must be exactly `url` and `anon_key` (not `anon-key` or `anonKey`)

---

**Remember:** The Streamlit app and React app are separate. This guide is for the Streamlit (Python) version. For the React app deployment, see `GITHUB_DEPLOYMENT_GUIDE.md`.
