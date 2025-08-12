# 🚀 VPS Setup Guide for VegaXPixelDrain

This guide will help you set up full automation on your existing VPS instance.

## 📋 Prerequisites

- VPS with Ubuntu/Debian/CentOS
- Node.js 18+ installed
- SSH access to your VPS
- At least 2GB RAM and 10GB disk space

## 🔧 One-Time Setup

### 1. Deploy the Application
```bash
# Make scripts executable
chmod +x deploy-vps.sh setup-cron.sh monitor.sh

# Deploy and start the service
npm run deploy
```

### 2. Setup Automation (Cron Jobs)
```bash
# Setup automated cron jobs
npm run setup-cron
```

### 3. Verify Everything is Working
```bash
# Check monitoring dashboard
npm run monitor

# Test the API
curl http://localhost:3002/health
curl http://localhost:3002/api/v1/process-all
```

## ⚡ What Gets Automated

### 🎬 Movie Processing (Every 6 Hours)
- **00:00** - Midnight processing
- **06:00** - Morning processing  
- **12:00** - Noon processing
- **18:00** - Evening processing

### 🔍 Health Monitoring (Every 30 Minutes)
- Checks if service is running
- Automatically restarts if down
- Logs all activities

## 📊 Monitoring & Control

### View Status
```bash
npm run monitor          # Full dashboard
pm2 status              # Process status
pm2 logs vegaxpixeldrain # Live logs
```

### Manual Controls
```bash
./run-automation.sh     # Run processing now
pm2 restart vegaxpixeldrain # Restart service
pm2 stop vegaxpixeldrain    # Stop service
```

### View Logs
```bash
# Automation logs
ls -la logs/
tail -f logs/automation_*.log

# Service logs  
pm2 logs vegaxpixeldrain
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
PORT=3002
HEADLESS_MODE=true      # Important for VPS
NODE_ENV=production
PIXELDRAIN_API_KEY=your_key
MAX_CONCURRENT_MOVIES=1
CLEANUP_DOWNLOADS=true
ENABLE_PROGRESS_BAR=false  # Disable for cron jobs
```

## 🌐 API Access

### Local Access (on VPS)
```bash
curl http://localhost:3002/health
curl http://localhost:3002/api/v1/process-all
```

### External Access (if firewall allows)
```bash
curl http://YOUR_VPS_IP:3002/health
curl http://YOUR_VPS_IP:3002/api/v1/process-all
```

### Secure External Access (recommended)
```bash
# Setup nginx reverse proxy (optional)
sudo apt install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/vegaxpixeldrain

# Add this config:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/vegaxpixeldrain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🛠️ Troubleshooting

### Service Not Starting
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs vegaxpixeldrain

# Restart service
pm2 restart vegaxpixeldrain
```

### Cron Jobs Not Running
```bash
# Check cron jobs
crontab -l

# Check cron service
sudo systemctl status cron

# Check automation logs
ls -la logs/
```

### Port Already in Use
```bash
# Find what's using port 3002
sudo lsof -i :3002

# Kill the process
sudo kill -9 <PID>

# Or change port in .env file
echo "PORT=3003" >> .env
```

### Memory Issues
```bash
# Check memory usage
free -h

# Restart service to free memory
pm2 restart vegaxpixeldrain

# Enable swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📈 Performance Optimization

### For Low-Memory VPS (1GB RAM)
```bash
# Add to .env
MAX_CONCURRENT_MOVIES=1
CLEANUP_DOWNLOADS=true
ENABLE_PROGRESS_BAR=false

# Enable swap
sudo swapon --show
```

### For High-Performance VPS (4GB+ RAM)
```bash
# Add to .env  
MAX_CONCURRENT_MOVIES=2
UV_THREADPOOL_SIZE=16
```

## 🔒 Security

### Firewall Setup
```bash
# Allow SSH and your app port
sudo ufw allow ssh
sudo ufw allow 3002
sudo ufw enable
```

### Process Security
```bash
# Run as non-root user
sudo adduser vegaxpixeldrain
sudo su - vegaxpixeldrain

# Setup in user directory
cd /home/vegaxpixeldrain
git clone <your-repo>
# ... continue setup
```

## 📞 Support Commands

### Quick Health Check
```bash
curl -s http://localhost:3002/health | jq
```

### Full System Status
```bash
npm run monitor
```

### Emergency Restart
```bash
pm2 restart vegaxpixeldrain
```

### View All Logs
```bash
# Service logs
pm2 logs vegaxpixeldrain --lines 100

# Automation logs
find logs/ -name "*.log" -exec tail -20 {} \;
```

---

## 🎉 You're All Set!

Your VegaXPixelDrain is now fully automated on your VPS:

✅ **Service running** with PM2 process management  
✅ **Automated processing** every 6 hours  
✅ **Health monitoring** every 30 minutes  
✅ **Automatic restarts** if service goes down  
✅ **Comprehensive logging** for debugging  
✅ **Easy monitoring** with dashboard  

**The system will now run completely automatically!** 🚀