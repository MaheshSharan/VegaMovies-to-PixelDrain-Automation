#!/bin/bash

# VegaXPixelDrain VPS Deployment Script
# For existing VPS instances

echo "🚀 Setting up VegaXPixelDrain automation on your VPS..."

# Install PM2 for process management (if not installed)
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 for process management..."
    npm install -g pm2
fi

# Stop existing processes
echo "🛑 Stopping existing processes..."
pm2 stop vegaxpixeldrain 2>/dev/null || echo "No existing process found"
pm2 delete vegaxpixeldrain 2>/dev/null || echo "No existing process to delete"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start the application with PM2
echo "🚀 Starting VegaXPixelDrain with PM2..."
pm2 start server.js --name "vegaxpixeldrain" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo "✅ VegaXPixelDrain is now running with PM2!"
echo "📊 Monitor with: pm2 monit"
echo "📋 View logs with: pm2 logs vegaxpixeldrain"
echo "🔄 Restart with: pm2 restart vegaxpixeldrain"
echo ""
echo "🌐 Your API is running on: http://localhost:3002"
echo "🔍 Health check: curl http://localhost:3002/health"
echo "🎬 Process movies: curl http://localhost:3002/api/v1/process-all"