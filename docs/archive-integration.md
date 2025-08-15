# Internet Archive Integration

VegaXPixelDrain now supports Internet Archive as an alternative upload service to PixelDrain. This provides redundancy and additional features for your automated movie processing system.

## 🎯 Features

### **Smart Content Detection**
- **Automatic Movie/TV Show Detection**: Based on title patterns (Season, Episode, S01E01, etc.)
- **Separate Collections**: Movies go to `vegaxpixeldrain-movies`, TV shows to `vegaxpixeldrain-tvshows`
- **Rich Metadata**: Automatically extracts quality, language, format, and year from titles

### **Rich Metadata Generation**
Each upload includes comprehensive metadata:
- **Title**: Clean movie/show name
- **Description**: Quality, language, format, upload date
- **Tags**: Quality (720p, 1080p, 4K), language (Hindi, English), format (BluRay, WebRip)
- **Creator**: Your Internet Archive username
- **License**: Public domain for accessibility

### **Permanent URLs**
- **Stable Links**: Once uploaded, files get permanent archive.org URLs
- **Global CDN**: Files distributed worldwide for fast access
- **No Expiration**: Files never expire or get deleted

## 🔧 Configuration

### **Environment Variables**

Add these to your `.env` file:

```bash
# Upload Service Selection
UPLOAD_SERVICE=archive  # Options: "pixeldrain" or "archive"

# Internet Archive Credentials
ARCHIVE_ACCESS_KEY=your_access_key_here
ARCHIVE_SECRET_KEY=your_secret_key_here
ARCHIVE_USERNAME=your_username_here
ARCHIVE_COLLECTION=vegaxpixeldrain-movies  # Auto-created if not exists
```

### **Getting Internet Archive Credentials**

1. **Create Account**: Sign up at [archive.org](https://archive.org)
2. **Get API Keys**: Go to your account settings → API Keys
3. **Generate Credentials**: Create new access key and secret key
4. **Set Permissions**: Ensure your account has upload permissions

## 🚀 Usage

### **Service Selection**

The system automatically uses the service specified in `UPLOAD_SERVICE`:

```bash
# Use Internet Archive
UPLOAD_SERVICE=archive

# Use PixelDrain (default)
UPLOAD_SERVICE=pixeldrain
```

### **Testing Integration**

```bash
# Test Internet Archive connection
npm run test-archive

# Check service status
curl http://localhost:3002/health

# View service info
curl http://localhost:3002/api/v1/docs
```

### **Monitoring**

The monitoring dashboard now shows:
- **Upload Service**: Which service is active (PixelDrain or Internet Archive)
- **Service Status**: Health status of the upload service
- **Collections**: Active collections for the service

```bash
npm run monitor
```

## 📁 Collections Structure

### **Movies Collection**: `vegaxpixeldrain-movies`
- All movie content (no season/episode patterns)
- Rich metadata with quality, language, format
- Permanent archive.org URLs

### **TV Shows Collection**: `vegaxpixeldrain-tvshows`
- All TV show content (contains season/episode patterns)
- Same rich metadata structure
- Separate organization for easy browsing

## 🔍 Smart Detection Examples

### **Movie Detection**
```
"Movie Name 2025 Hindi 720p BluRay" → Movies Collection
"Another Movie 1080p WebRip" → Movies Collection
"Action Movie 4K HDRip" → Movies Collection
```

### **TV Show Detection**
```
"Show Name Season 1 Episode 1 720p" → TV Shows Collection
"Series S01E02 1080p" → TV Shows Collection
"TV Show Episode 5 4K" → TV Shows Collection
```

## 📊 Metadata Examples

### **Generated Description**
```
Movie: Clean Movie Name (2025)
Quality: 720p
Language: Hindi
Format: BluRay
Source: VegaXPixelDrain Automation
Upload Date: 2025-01-15
Uploader: starlight723
```

### **Auto-Generated Tags**
- `vegaxpixeldrain`
- `automated-upload`
- `movie` or `tvshow`
- `720p`, `1080p`, `4k`
- `hindi`, `english`, `dual-audio`
- `bluray`, `webrip`, `hdtv`
- `2025` (year if found)

## 🔄 Switching Services

### **To Internet Archive**
```bash
# Update .env file
echo "UPLOAD_SERVICE=archive" >> .env

# Restart service
pm2 restart vegaxpixeldrain

# Test connection
npm run test-archive
```

### **Back to PixelDrain**
```bash
# Update .env file
echo "UPLOAD_SERVICE=pixeldrain" >> .env

# Restart service
pm2 restart vegaxpixeldrain
```

## 🛡️ Security & Privacy

### **Public Access**
- **Files are publicly accessible** (Internet Archive's mission)
- **No private uploads** available
- **Metadata is public** for discovery

### **Data Handling**
- **Local files deleted** after successful upload
- **No personal data** stored in metadata
- **Username only** for attribution

## 🚨 Troubleshooting

### **Common Issues**

1. **Authentication Failed**
   ```bash
   # Check credentials
   echo $ARCHIVE_ACCESS_KEY
   echo $ARCHIVE_SECRET_KEY
   echo $ARCHIVE_USERNAME
   ```

2. **Collection Not Found**
   - Collections are auto-created on first upload
   - Check account permissions on archive.org

3. **Upload Timeout**
   - Large files may take time
   - Check network connection
   - Verify file size limits

### **Testing Commands**
```bash
# Test connection
npm run test-archive

# Check health
curl http://localhost:3002/health

# View logs
pm2 logs vegaxpixeldrain

# Monitor system
npm run monitor
```

## 📈 Benefits Over PixelDrain

### **Advantages**
- ✅ **Completely Free**: No storage or bandwidth limits
- ✅ **Permanent URLs**: Files never expire
- ✅ **Global CDN**: Faster worldwide access
- ✅ **Rich Metadata**: Better organization and discovery
- ✅ **Public Mission**: Part of digital preservation
- ✅ **No Rate Limits**: Unlimited uploads

### **Considerations**
- ⚠️ **Public Access**: Files are publicly accessible
- ⚠️ **No Privacy**: No private upload option
- ⚠️ **Metadata Public**: All metadata is public

## 🎯 Integration with Existing System

The Internet Archive integration seamlessly works with your existing:
- ✅ **Chrome Profile Automation**: Same browser automation
- ✅ **Multi-source Scraping**: Same content discovery
- ✅ **Smart Duplicate Detection**: Same matching logic
- ✅ **Progress Tracking**: Same professional logging
- ✅ **Error Handling**: Same retry and recovery
- ✅ **VPS Deployment**: Same automation and monitoring

Your existing automation pipeline remains unchanged - only the upload destination changes based on the `UPLOAD_SERVICE` environment variable.
