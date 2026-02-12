# Push to GitHub Instructions

Your code is ready to push! Follow these steps:

## 1. Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `fantasy-football-dashboard` (or your choice)
3. Choose Public or Private
4. **Do NOT check** "Initialize with README"
5. Click "Create repository"

## 2. Connect and Push

After creating the repository, run these commands:

```bash
# Add your GitHub repository as the remote
git remote add origin https://github.com/jacklawrencecmg/REPO_NAME.git

# Push your code
git push -u origin main
```

Replace `REPO_NAME` with your actual repository name.

## 3. Configure GitHub Secrets

For deployment to work, add these secrets:

1. Go to your repository on GitHub
2. Click Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add these two secrets:

**Secret 1:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://xtkwonklknqzpstedjhg.supabase.co`

**Secret 2:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0a3dvbmtsa25xenBzdGVkamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzAwODksImV4cCI6MjA4NTcwNjA4OX0.vDASpFYH0NlMVTyyQUSC1wD2o2WhTrAyJ6dwpjiYD9w`

## 4. Enable GitHub Pages

1. Go to Settings > Pages
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. Save

## 5. Your Site Will Be Live At:

```
https://jacklawrencecmg.github.io/REPO_NAME/
```

The first deployment happens automatically after you push!

## Quick Commands Reference

```bash
# See current status
git status

# Make changes and commit
git add .
git commit -m "Description of changes"
git push

# View remote URL
git remote -v
```

## Troubleshooting

### If remote already exists:
```bash
git remote remove origin
git remote add origin https://github.com/jacklawrencecmg/REPO_NAME.git
```

### If push is rejected:
```bash
git pull origin main --rebase
git push -u origin main
```

### To update base path in vite.config.ts:
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/REPO_NAME/',  // Add your repo name here
});
```

Then rebuild and push:
```bash
npm run build
git add .
git commit -m "Update base path"
git push
```
