# Deployment Guide

Deploy your Fantasy Football Trade Analyzer to the cloud for 24/7 access.

## 🌐 Deployment Options

### Option 1: Streamlit Community Cloud (Recommended - Free)

**Best for:** Personal use, small leagues

**Steps:**

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Fantasy Football Trade Analyzer"
   git branch -M main
   git remote add origin https://github.com/yourusername/fantasy-trade-analyzer.git
   git push -u origin main
   ```

2. **Sign up for Streamlit Cloud**
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Sign in with GitHub
   - Click "New app"

3. **Deploy Configuration**
   - Repository: `yourusername/fantasy-trade-analyzer`
   - Branch: `main`
   - Main file path: `app.py`
   - Click "Deploy"

4. **Add Secrets (Optional)**
   If using SportsDataIO API:
   - Go to app settings → Secrets
   - Add:
     ```toml
     SPORTSDATAIO_API_KEY = "your_key_here"
     ```
   - Update `app.py` to read from secrets:
     ```python
     import streamlit as st
     API_KEY = st.secrets.get("SPORTSDATAIO_API_KEY", "YOUR_SPORTSDATAIO_KEY_HERE")
     ```

**Limits:**
- Free tier: Unlimited apps
- Resources: 1 GB RAM, shared CPU
- Uptime: Auto-sleep after inactivity
- Perfect for personal use

---

### Option 2: Heroku

**Best for:** Custom domain, always-on

**Steps:**

1. **Create `Procfile`**
   ```
   web: sh setup.sh && streamlit run app.py
   ```

2. **Create `setup.sh`**
   ```bash
   mkdir -p ~/.streamlit/
   echo "\
   [server]\n\
   headless = true\n\
   port = $PORT\n\
   enableCORS = false\n\
   \n\
   " > ~/.streamlit/config.toml
   ```

3. **Create `runtime.txt`**
   ```
   python-3.11.0
   ```

4. **Deploy to Heroku**
   ```bash
   heroku login
   heroku create fantasy-trade-analyzer
   git push heroku main
   heroku open
   ```

5. **Add Config Vars**
   ```bash
   heroku config:set SPORTSDATAIO_API_KEY=your_key_here
   ```

**Cost:**
- Free tier: 550-1000 dyno hours/month
- Hobby: $7/month (always on)
- Custom domains supported

---

### Option 3: AWS EC2

**Best for:** Full control, enterprise use

**Steps:**

1. **Launch EC2 Instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t2.micro (free tier)
   - Security group: Allow port 8501

2. **SSH and Setup**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip

   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Python
   sudo apt install python3 python3-pip -y

   # Clone repository
   git clone https://github.com/yourusername/fantasy-trade-analyzer.git
   cd fantasy-trade-analyzer

   # Install dependencies
   pip3 install -r requirements.txt
   ```

3. **Run with systemd**
   Create `/etc/systemd/system/streamlit.service`:
   ```ini
   [Unit]
   Description=Streamlit Fantasy Football Analyzer
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/home/ubuntu/fantasy-trade-analyzer
   ExecStart=/usr/local/bin/streamlit run app.py --server.port 8501
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

4. **Enable and Start**
   ```bash
   sudo systemctl enable streamlit
   sudo systemctl start streamlit
   ```

5. **Setup Nginx (Optional)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:8501;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

**Cost:**
- t2.micro: Free tier (1 year)
- t2.small: ~$17/month
- Full control and customization

---

### Option 4: Docker

**Best for:** Containerized deployment, Kubernetes

**Create `Dockerfile`:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8501

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Run app
ENTRYPOINT ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  streamlit:
    build: .
    ports:
      - "8501:8501"
    environment:
      - SPORTSDATAIO_API_KEY=${SPORTSDATAIO_API_KEY}
    volumes:
      - .:/app
    restart: unless-stopped
```

**Deploy:**
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

### Option 5: Azure App Service

**Best for:** Microsoft ecosystem integration

**Steps:**

1. **Create `startup.sh`**
   ```bash
   python -m streamlit run app.py --server.port 8000 --server.address 0.0.0.0
   ```

2. **Deploy via Azure CLI**
   ```bash
   az login
   az webapp up --runtime PYTHON:3.11 --sku B1 --name fantasy-trade-analyzer
   ```

3. **Configure App Settings**
   ```bash
   az webapp config appsettings set --name fantasy-trade-analyzer \
     --settings SPORTSDATAIO_API_KEY=your_key_here
   ```

**Cost:**
- Free tier: F1 (limited)
- Basic: B1 ~$13/month
- Standard: S1 ~$70/month

---

## 🔒 Security Best Practices

### Environment Variables
Never commit API keys to git:

**Add to `.gitignore`:**
```
.env
config.py
secrets.toml
```

**Use environment variables:**
```python
import os
API_KEY = os.environ.get('SPORTSDATAIO_API_KEY', 'YOUR_SPORTSDATAIO_KEY_HERE')
```

### HTTPS
Always use HTTPS in production:
- Streamlit Cloud: HTTPS by default
- Heroku: HTTPS by default
- AWS/Azure: Use ALB/App Gateway
- Self-hosted: Use Let's Encrypt

### Rate Limiting
Implement rate limiting for API calls:
```python
import time
from functools import wraps

def rate_limit(max_per_minute=50):
    min_interval = 60.0 / max_per_minute
    last_called = [0.0]

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            left_to_wait = min_interval - elapsed
            if left_to_wait > 0:
                time.sleep(left_to_wait)
            ret = func(*args, **kwargs)
            last_called[0] = time.time()
            return ret
        return wrapper
    return decorator
```

---

## 📊 Monitoring & Analytics

### Streamlit Built-in Analytics
- View app usage stats in Streamlit Cloud dashboard
- Track unique visitors, sessions, errors

### Custom Analytics
Add Google Analytics:
```python
# In app.py
st.components.v1.html("""
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YOUR-ID');
</script>
""", height=0)
```

### Error Logging
Use Sentry for error tracking:
```python
import sentry_sdk
sentry_sdk.init(dsn="your-sentry-dsn")
```

---

## 🚀 Performance Optimization

### Caching Strategy
Already implemented in `app.py`:
- Player data: 24 hours
- Projections: 1 hour
- League data: 1 hour

**Optimize further:**
```python
# Use session state for user-specific data
if 'user_roster' not in st.session_state:
    st.session_state.user_roster = fetch_roster(user_id)
```

### Database Integration
For production, consider adding database:

**Using Supabase (as per project setup):**
```python
from supabase import create_client

supabase = create_client(
    os.environ.get('SUPABASE_URL'),
    os.environ.get('SUPABASE_KEY')
)

# Cache player data in database
def cache_player_data(players):
    supabase.table('players').upsert(players).execute()

def get_cached_players():
    response = supabase.table('players').select('*').execute()
    return response.data
```

### CDN for Static Assets
If adding images/assets:
- Use Cloudflare for CDN
- Optimize images (WebP format)
- Lazy load non-critical content

---

## 📱 Mobile Optimization

Streamlit is responsive, but enhance mobile experience:

```python
# Detect mobile
is_mobile = st.checkbox('Mobile View', value=False)

if is_mobile:
    # Use single column layout
    st.write("Mobile optimized view")
else:
    # Use multi-column layout
    col1, col2 = st.columns(2)
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Streamlit Cloud

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: python test_setup.py

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Streamlit Cloud deploy
        run: echo "Streamlit Cloud auto-deploys on push"
```

---

## 🆘 Troubleshooting Deployment

### Common Issues

**Issue: App won't start**
```bash
# Check logs
streamlit run app.py --logger.level=debug

# Verify Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

**Issue: Memory errors**
```python
# Reduce cache size
@st.cache_data(ttl=3600, max_entries=100)
def fetch_data():
    pass
```

**Issue: Slow API calls**
```python
# Implement timeout
response = requests.get(url, timeout=5)

# Use concurrent requests
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(fetch_data, id) for id in ids]
```

**Issue: CORS errors**
```python
# Add to config.toml
[server]
enableCORS = false
enableXsrfProtection = false
```

---

## 📈 Scaling Considerations

### For Large Leagues (50+ users)

1. **Add Redis for caching:**
   ```python
   import redis
   r = redis.Redis(host='localhost', port=6379)

   def get_cached_data(key):
       data = r.get(key)
       if data:
           return json.loads(data)
       return None

   def set_cached_data(key, data, ttl=3600):
       r.setex(key, ttl, json.dumps(data))
   ```

2. **Use background workers:**
   ```python
   import celery
   app = celery.Celery('tasks', broker='redis://localhost:6379')

   @app.task
   def update_projections():
       # Heavy computation
       pass
   ```

3. **Horizontal scaling:**
   - Use Kubernetes for auto-scaling
   - Load balancer for multiple instances
   - Shared cache (Redis) across instances

---

## ✅ Deployment Checklist

Before going live:

- [ ] API keys stored as environment variables
- [ ] `.env` added to `.gitignore`
- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] HTTPS enabled
- [ ] Analytics setup
- [ ] Backup strategy in place
- [ ] Documentation updated
- [ ] Performance testing completed
- [ ] Mobile responsiveness checked

---

## 🎯 Recommended Setup for Different Scales

**Personal Use (1-10 users):**
- ✅ Streamlit Community Cloud
- Cost: Free
- Setup time: 5 minutes

**Small League (10-50 users):**
- ✅ Heroku Hobby
- ✅ Add Redis for caching
- Cost: $7/month
- Setup time: 30 minutes

**Multiple Leagues (50-200 users):**
- ✅ AWS EC2 t2.small
- ✅ PostgreSQL database
- ✅ Nginx reverse proxy
- Cost: ~$30/month
- Setup time: 2 hours

**Enterprise (200+ users):**
- ✅ AWS ECS/EKS (containerized)
- ✅ RDS PostgreSQL
- ✅ ElastiCache Redis
- ✅ CloudFront CDN
- ✅ Auto-scaling
- Cost: $100-500/month
- Setup time: 1-2 days

---

Ready to deploy? Start with Streamlit Community Cloud and scale up as needed! 🚀
