# VPS Chrome Profile Setup Commands

Run these commands on your VPS to use your real Chrome profile:

## 1. Make the setup script executable and run it
```bash
chmod +x chrome-profile-setup.sh
./chrome-profile-setup.sh
```

## 2. Update your code files
```bash
# Pull the latest changes if you've pushed them
git pull origin main

# Or copy the updated services/vegamovies.js file manually
```

## 3. Close Chrome if it's running (recommended)
```bash
# Check if Chrome is running
ps aux | grep google-chrome

# Close Chrome (recommended for clean automation)
pkill -f google-chrome

# Wait a few seconds
sleep 3
```

## 4. Test the Chrome executable path
```bash
# Check if Chrome is installed at the expected location
ls -la /opt/google/chrome/chrome

# If not found, find the correct path
which google-chrome
whereis google-chrome
```

## 5. Restart the service
```bash
pm2 restart vegaxpixeldrain
pm2 logs vegaxpixeldrain
```

## 6. Test the automation
```bash
curl http://localhost:3002/api/v1/process-all
```

## What This Setup Does:

✅ **Uses Your Real Chrome Profile** - All your browsing history, cookies, sessions
✅ **Loads Your Extensions** - Any ad blockers, privacy tools you have installed  
✅ **Uses Your Settings** - Language, timezone, preferences
✅ **Maintains Your Sessions** - Logged-in accounts, saved passwords
✅ **Real User Agent** - Your actual Chrome's user agent string
✅ **Real Viewport** - Your actual screen resolution and settings

## Expected Benefits:

- **Virtually Undetectable** - Using your real browsing profile
- **No Captchas** - Sites will recognize your "trusted" browser
- **Faster Processing** - No need to solve verification challenges
- **Better Success Rate** - Sites trust your established browsing pattern

## Important Notes:

- The automation will use your real Chrome profile, so it might access your logged-in accounts
- Make sure you're comfortable with this before running
- Your browsing history will show the automated visits
- Any cookies/sessions from the automation will be saved to your profile

Let me know if you need any adjustments!