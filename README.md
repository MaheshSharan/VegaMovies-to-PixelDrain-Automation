# VegaMovies to PixelDrain Automation

Automated system that scrapes VegaMovies, downloads missing content, and uploads to PixelDrain.

## 🏗️ Project Structure

```
├── server.js              # Main API server
├── services/
│   ├── vegamovies.js      # VegaMovies scraping logic
│   ├── pixeldrain.js      # PixelDrain API integration
│   └── linkFetcher.js     # Download link extraction & file processing
├── data/                  # JSON data files (auto-generated)
│   ├── missing_movies.json
│   ├── uploaded_movies.json
│   └── movies_with_links.json
├── downloads/             # Temporary download storage
├── cron-job.js           # Automated execution script
└── deploy-gcp.sh         # GCP deployment script
```

## 🚀 Quick Start

### Local Development
```bash
npm install
npm start
```

### API Endpoints
- `GET /movies` - Scrape VegaMovies and match with PixelDrain
- `GET /fetch-links` - Download and upload missing movies
- `GET /health` - Health check

## 🌐 Production Deployment

### Google Cloud Platform (Recommended)

1. **Setup GCP Project**
```bash
gcloud config set project your-project-id
gcloud auth login
```

2. **Set Environment Variables**
```bash
export PIXELDRAIN_API_KEY="your-api-key"
```

3. **Deploy to Cloud Run**
```bash
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

This will:
- Deploy the service to Cloud Run
- Set up automated scheduling (6 AM & 6 PM daily)
- Configure proper resource limits (2GB RAM, 2 CPU)

### Alternative: Linux VPS

1. **Install Dependencies**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Playwright dependencies
npx playwright install-deps chromium
```

2. **Setup Service**
```bash
sudo cp vegamovies.service /etc/systemd/system/
sudo systemctl enable vegamovies
sudo systemctl start vegamovies
```

3. **Setup Cron Jobs**
```bash
crontab crontab.txt
```

## ⚙️ Configuration

### Environment Variables
- `PIXELDRAIN_API_KEY` - Your PixelDrain API key
- `NODE_ENV` - Set to "production" for production
- `PORT` - Server port (default: 3000)

### Download Preferences
- Currently configured for 720p downloads only (to stay under 2GB limit)
- Supports G-Direct and Normal download links
- Automatic Cloudflare challenge solving

## 📊 Monitoring

### Logs
- **GCP**: View logs in Cloud Console
- **Linux**: `journalctl -u vegamovies -f`

### Health Check
```bash
curl http://your-service-url/health
```

## 🔄 Automation Schedule

- **6:00 AM**: Scrape movies and match with PixelDrain
- **6:05 AM**: Download and upload missing movies
- **6:00 PM**: Repeat process
- **6:05 PM**: Repeat process

## 🛠️ Troubleshooting

### Common Issues
1. **File too large**: Increase PixelDrain subscription or switch to 480p
2. **Cloudflare blocks**: Service includes automatic challenge solving
3. **Download failures**: Automatic retry logic with 3 attempts per movie

### Debug Mode
```bash
NODE_ENV=development npm start
```

## 📈 Performance

- **Memory**: 2GB recommended for large files
- **CPU**: 2 cores for parallel processing
- **Storage**: Temporary downloads are auto-cleaned
- **Network**: Optimized for large file transfers

## 🔒 Security

- API keys stored as environment variables
- No sensitive data in logs
- Automatic file cleanup after upload
- Health checks for monitoring