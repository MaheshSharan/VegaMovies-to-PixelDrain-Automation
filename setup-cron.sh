#!/bin/bash

# VegaXPixelDrain Cron Job Setup Script

echo "⏰ Setting up automated cron jobs for VegaXPixelDrain..."

# Get the current directory
CURRENT_DIR=$(pwd)
LOG_DIR="$CURRENT_DIR/logs"

# Create logs directory
mkdir -p "$LOG_DIR"

# Create the cron job script
cat > "$CURRENT_DIR/run-automation.sh" << 'EOF'
#!/bin/bash

# VegaXPixelDrain Automation Script
# This script runs the full movie processing pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
DATE=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="$LOG_DIR/automation_$DATE.log"

echo "🎬 Starting VegaXPixelDrain automation at $(date)" >> "$LOG_FILE"

# Check if the service is running
if ! curl -s http://localhost:3002/health > /dev/null; then
    echo "❌ Service is not running, starting it..." >> "$LOG_FILE"
    cd "$SCRIPT_DIR"
    pm2 restart vegaxpixeldrain >> "$LOG_FILE" 2>&1
    sleep 10
fi

# Run the full automation
echo "🚀 Running full movie processing..." >> "$LOG_FILE"
RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" http://localhost:3002/api/v1/process-all)
HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Automation completed successfully" >> "$LOG_FILE"
    echo "$BODY" >> "$LOG_FILE"
else
    echo "❌ Automation failed with status $HTTP_STATUS" >> "$LOG_FILE"
    echo "$BODY" >> "$LOG_FILE"
fi

echo "🏁 Automation finished at $(date)" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

# Keep only last 10 log files
cd "$LOG_DIR"
ls -t automation_*.log | tail -n +11 | xargs -r rm
EOF

# Make the automation script executable
chmod +x "$CURRENT_DIR/run-automation.sh"

# Create cron jobs
echo "📝 Setting up cron jobs..."

# Remove existing VegaXPixelDrain cron jobs
crontab -l 2>/dev/null | grep -v "vegaxpixeldrain\|VegaXPixelDrain" | crontab -

# Add new cron jobs
(crontab -l 2>/dev/null; echo "# VegaXPixelDrain Automation") | crontab -
(crontab -l 2>/dev/null; echo "0 */6 * * * $CURRENT_DIR/run-automation.sh # Process movies every 6 hours") | crontab -
(crontab -l 2>/dev/null; echo "*/30 * * * * curl -s http://localhost:3002/health > /dev/null || pm2 restart vegaxpixeldrain # Health check every 30 minutes") | crontab -

echo "✅ Cron jobs setup complete!"
echo ""
echo "📋 Scheduled tasks:"
echo "   - Process movies: Every 6 hours (00:00, 06:00, 12:00, 18:00)"
echo "   - Health check: Every 30 minutes"
echo ""
echo "📊 Monitor automation:"
echo "   - View logs: ls -la $LOG_DIR/"
echo "   - Latest log: tail -f $LOG_DIR/automation_*.log"
echo "   - Cron jobs: crontab -l"
echo ""
echo "🔧 Manual controls:"
echo "   - Run now: $CURRENT_DIR/run-automation.sh"
echo "   - Check service: pm2 status"
echo "   - View service logs: pm2 logs vegaxpixeldrain"