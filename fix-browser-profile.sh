#!/bin/bash

echo "🔧 Fixing browser profile directory..."

# Stop the service first
echo "Stopping VegaXPixelDrain service..."
pm2 stop vegaxpixeldrain 2>/dev/null || echo "Service not running"

# Remove old browser profiles
echo "Cleaning up old browser profiles..."
rm -rf browser_profile/
rm -rf services/browser_profile/
rm -rf chrome-profile/

# Create new chrome-profile directory
echo "Creating new chrome-profile directory..."
mkdir -p chrome-profile

# Set proper permissions
chmod 755 chrome-profile

# Restart the service
echo "Restarting VegaXPixelDrain service..."
pm2 restart vegaxpixeldrain

echo "✅ Browser profile fixed!"
echo "📁 Using chrome-profile directory for consistent browser sessions"
echo "🔍 Check with: ls -la chrome-profile/"