#!/bin/bash

# VegaXPixelDrain Monitoring Script

clear
echo "🎬 VegaXPixelDrain Monitoring Dashboard"
echo "======================================="
echo ""

# Check service status
echo "📊 Service Status:"
if curl -s http://localhost:3002/health > /dev/null; then
    echo "   ✅ API Service: RUNNING"
    HEALTH=$(curl -s http://localhost:3002/health | jq -r '.status' 2>/dev/null || echo "healthy")
    echo "   🔍 Health: $HEALTH"
else
    echo "   ❌ API Service: NOT RUNNING"
fi

# PM2 Status
echo ""
echo "🔧 PM2 Process Status:"
pm2 jlist | jq -r '.[] | select(.name=="vegaxpixeldrain") | "   Process: \(.name) | Status: \(.pm2_env.status) | CPU: \(.monit.cpu)% | Memory: \(.monit.memory/1024/1024 | floor)MB"' 2>/dev/null || echo "   PM2 not available or process not found"

# Disk space
echo ""
echo "💾 Disk Usage:"
df -h . | tail -1 | awk '{print "   Available: " $4 " (" $5 " used)"}'

# Memory usage
echo ""
echo "🧠 Memory Usage:"
free -h | grep "Mem:" | awk '{print "   Available: " $7 " / " $2}'

# Recent logs
echo ""
echo "📋 Recent Activity (last 10 lines):"
if [ -d "logs" ] && [ "$(ls -A logs/automation_*.log 2>/dev/null)" ]; then
    LATEST_LOG=$(ls -t logs/automation_*.log | head -1)
    echo "   From: $LATEST_LOG"
    tail -10 "$LATEST_LOG" | sed 's/^/   /'
else
    echo "   No automation logs found"
fi

# Cron jobs
echo ""
echo "⏰ Scheduled Tasks:"
crontab -l 2>/dev/null | grep -E "(vegaxpixeldrain|VegaXPixelDrain|process-all)" | sed 's/^/   /' || echo "   No cron jobs found"

echo ""
echo "🔧 Quick Actions:"
echo "   1. Run automation now: ./run-automation.sh"
echo "   2. Restart service: pm2 restart vegaxpixeldrain"
echo "   3. View live logs: pm2 logs vegaxpixeldrain"
echo "   4. Process movies: curl http://localhost:3002/api/v1/process-all"
echo ""