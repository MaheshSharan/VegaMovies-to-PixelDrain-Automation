#!/bin/bash

echo "🔧 Setting up Chrome profile for automation..."

# Check if Chrome is currently running
CHROME_PROCESSES=$(ps aux | grep -v grep | grep -c "google-chrome")

if [ $CHROME_PROCESSES -gt 0 ]; then
    echo "⚠️  Chrome is currently running ($CHROME_PROCESSES processes)"
    echo "For best results, close Chrome before running automation"
    echo ""
    echo "Chrome processes:"
    ps aux | grep -v grep | grep "google-chrome" | head -5
    echo ""
    echo "To close Chrome:"
    echo "  pkill -f google-chrome"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled. Close Chrome and try again."
        exit 1
    fi
fi

# Check if Chrome profile exists
CHROME_PROFILE="/home/$(whoami)/.config/google-chrome/Default"

if [ -d "$CHROME_PROFILE" ]; then
    echo "✅ Chrome Default profile found: $CHROME_PROFILE"
    echo "📊 Profile size: $(du -sh "$CHROME_PROFILE" | cut -f1)"
    echo "📅 Last modified: $(stat -c %y "$CHROME_PROFILE" | cut -d' ' -f1-2)"
else
    echo "❌ Chrome Default profile not found at: $CHROME_PROFILE"
    echo "Please make sure Chrome is installed and has been used at least once."
    exit 1
fi

# Check profile permissions
if [ -r "$CHROME_PROFILE" ] && [ -w "$CHROME_PROFILE" ]; then
    echo "✅ Profile permissions are correct"
else
    echo "⚠️  Profile permission issues detected"
    echo "Fixing permissions..."
    chmod -R u+rw "$CHROME_PROFILE"
fi

# Remove any lock files that might prevent access
echo "🧹 Cleaning up Chrome lock files..."
rm -f "$CHROME_PROFILE/SingletonLock" 2>/dev/null
rm -f "$CHROME_PROFILE/SingletonSocket" 2>/dev/null
rm -f "$CHROME_PROFILE/SingletonCookie" 2>/dev/null

echo ""
echo "✅ Chrome profile setup complete!"
echo "🎯 Automation will use your real Chrome profile with:"
echo "   - Your browsing history"
echo "   - Your cookies and sessions"
echo "   - Your extensions and settings"
echo "   - Your saved passwords and autofill"
echo ""
echo "This should make the automation virtually undetectable!"