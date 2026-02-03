# Streamlit Quick Start (3 Steps)

## Local Development

```bash
# Step 1: Install dependencies
pip install -r requirements.txt

# Step 2: Secrets file is already created at .streamlit/secrets.toml

# Step 3: Run the app
streamlit run app.py
```

That's it! App will open at `http://localhost:8501`

## Deploy to Streamlit Cloud

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Deploy Streamlit app"
git push origin main
```

### Step 2: Deploy on Streamlit Cloud

1. Go to https://share.streamlit.io
2. Sign in with GitHub
3. Click "New app"
4. Select your repository and branch
5. Set main file: `app.py`
6. Click "Advanced settings"

### Step 3: Add Secrets

In the "Secrets" box, paste:

```toml
[supabase]
url = "https://xtkwonklknqzpstedjhg.supabase.co"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0a3dvbmtsa25xenBzdGVkamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzAwODksImV4cCI6MjA4NTcwNjA4OX0.vDASpFYH0NlMVTyyQUSC1wD2o2WhTrAyJ6dwpjiYD9w"
```

Click "Deploy!"

Wait 2-3 minutes and your app will be live.

## What Was Fixed

✓ Added missing dependencies to `requirements.txt`:
  - `supabase` (Python client)
  - `scikit-learn` (for ML features)
  - `numpy` (for calculations)

✓ Updated `auth_utils.py` to read from Streamlit secrets

✓ Created `.streamlit/secrets.toml` for local development

✓ Created `.streamlit/secrets.toml.example` as template

✓ Added `.streamlit/secrets.toml` to `.gitignore` for security

## Troubleshooting

**Error: "Supabase credentials not configured"**
- Local: Check that `.streamlit/secrets.toml` exists
- Cloud: Add secrets in Streamlit Cloud app settings

**Error: "ModuleNotFoundError"**
```bash
pip install -r requirements.txt
```

**Error: Can't connect to Supabase**
- Verify URL and key in secrets match your Supabase project
- Check Supabase dashboard: Settings → API

## Files Changed

- `requirements.txt` - Added supabase, scikit-learn, numpy
- `auth_utils.py` - Reads from Streamlit secrets
- `.streamlit/secrets.toml` - Local secrets file (created)
- `.streamlit/secrets.toml.example` - Template
- `.gitignore` - Added secrets.toml

## Documentation

- Full guide: `STREAMLIT_DEPLOYMENT_GUIDE.md`
- React app deployment: `GITHUB_DEPLOYMENT_GUIDE.md`

---

**Note:** This project has both a Streamlit (Python) app and a React (JavaScript) app. This guide is for the Streamlit version. They are separate apps with different deployment processes.
