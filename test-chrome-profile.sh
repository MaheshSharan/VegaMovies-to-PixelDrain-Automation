#!/bin/bash

echo "🧪 Testing Chrome Profile Integration..."

# Check if Chrome profile exists
CHROME_PROFILE="/home/$(whoami)/.config/google-chrome/Default"

echo "1. Checking Chrome profile..."
if [ -d "$CHROME_PROFILE" ]; then
    echo "   ✅ Profile exists: $CHROME_PROFILE"
    echo "   📊 Size: $(du -sh "$CHROME_PROFILE" | cut -f1)"
    
    # Check key files
    if [ -f "$CHROME_PROFILE/Preferences" ]; then
        echo "   ✅ Preferences file found"
    else
        echo "   ❌ Preferences file missing"
    fi
    
    if [ -f "$CHROME_PROFILE/History" ]; then
        echo "   ✅ History file found"
    else
        echo "   ❌ History file missing"
    fi
    
    if [ -f "$CHROME_PROFILE/Cookies" ]; then
        echo "   ✅ Cookies file found"
    else
        echo "   ❌ Cookies file missing"
    fi
else
    echo "   ❌ Profile not found: $CHROME_PROFILE"
    exit 1
fi

echo ""
echo "2. Checking Chrome executable..."
CHROME_PATHS=(
    "/opt/google/chrome/chrome"
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium-browser"
    "/usr/bin/chromium"
)

CHROME_FOUND=""
for chrome_path in "${CHROME_PATHS[@]}"; do
    if [ -f "$chrome_path" ]; then
        echo "   ✅ Found Chrome: $chrome_path"
        CHROME_FOUND="$chrome_path"
        break
    fi
done

if [ -z "$CHROME_FOUND" ]; then
    echo "   ❌ No Chrome executable found"
    exit 1
fi

echo ""
echo "3. Testing service health..."
curl -s http://localhost:3002/health | jq . 2>/dev/null || curl -s http://localhost:3002/health

echo ""
echo "4. Testing Chrome profile loading..."
echo "   Starting a quick test..."

# Test just the browser setup (not full processing)
curl -s -X GET "http://localhost:3002/api/v1/movies" &
CURL_PID=$!

# Wait a bit and check logs
sleep 5
echo ""
echo "5. Recent logs from service:"
pm2 logs vegaxpixeldrain --lines 10 --nostream

# Kill the test request if still running
kill $CURL_PID 2>/dev/null

echo ""
echo "✅ Chrome profile test complete!"
echo "Check the logs above to see if the profile loaded successfully."