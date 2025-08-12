# VPS Fix Commands

Run these commands on your VPS to fix the browser profile and detection issues:

## 1. Make the fix script executable and run it
```bash
chmod +x fix-browser-profile.sh
./fix-browser-profile.sh
```

## 2. Update the code files (copy the updated files from local)
```bash
# If you have the updated files locally, copy them to VPS
# Or pull from git if you've pushed the changes

git pull origin main
```

## 3. Install any missing dependencies
```bash
npm install
```

## 4. Restart the service with the new configuration
```bash
pm2 restart vegaxpixeldrain
pm2 logs vegaxpixeldrain
```

## 5. Test the headless mode setting
```bash
# Check if HEADLESS_MODE is set to false in .env
cat .env | grep HEADLESS_MODE

# If it shows true, change it to false
echo "HEADLESS_MODE=false" >> .env
```

## 6. Verify the browser profile
```bash
# Check if chrome-profile directory exists
ls -la chrome-profile/

# If it doesn't exist, create it
mkdir -p chrome-profile
chmod 755 chrome-profile
```

## 7. Test the API again
```bash
curl http://localhost:3002/health
curl http://localhost:3002/api/v1/process-all
```

## Key Changes Made:
- ✅ Fixed browser profile path from `browser_profile` to `chrome-profile`
- ✅ Removed playwright-extra dependency issues
- ✅ Added advanced stealth techniques directly in browser setup
- ✅ Fixed headless mode detection
- ✅ Enhanced user agent and viewport settings
- ✅ Added better button clicking logic with multiple fallback methods