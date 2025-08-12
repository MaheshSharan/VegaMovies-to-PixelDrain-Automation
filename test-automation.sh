#!/bin/bash

# VegaXPixelDrain Automation Test Script

echo "🧪 Testing VegaXPixelDrain Automation..."
echo "======================================="

# Test 1: Health Check
echo ""
echo "1️⃣ Testing Health Check..."
HEALTH_RESPONSE=$(curl -s http://localhost:3002/health)
if [ $? -eq 0 ]; then
    echo "   ✅ Health check successful"
    echo "   📊 Response: $HEALTH_RESPONSE"
else
    echo "   ❌ Health check failed"
    exit 1
fi

# Test 2: API Documentation
echo ""
echo "2️⃣ Testing API Documentation..."
DOCS_RESPONSE=$(curl -s http://localhost:3002/api/v1/docs)
if [ $? -eq 0 ]; then
    echo "   ✅ API docs accessible"
else
    echo "   ❌ API docs failed"
fi

# Test 3: Movie Scraping (quick test)
echo ""
echo "3️⃣ Testing Movie Scraping..."
echo "   ⏳ This may take a few minutes..."
MOVIES_RESPONSE=$(curl -s -m 300 http://localhost:3002/api/v1/movies)
if [ $? -eq 0 ]; then
    echo "   ✅ Movie scraping successful"
    # Extract counts from JSON response
    UPLOADED_COUNT=$(echo "$MOVIES_RESPONSE" | jq -r '.data.uploaded_count // 0' 2>/dev/null || echo "0")
    MISSING_COUNT=$(echo "$MOVIES_RESPONSE" | jq -r '.data.missing_count // 0' 2>/dev/null || echo "0")
    echo "   📊 Found: $UPLOADED_COUNT uploaded, $MISSING_COUNT missing"
else
    echo "   ❌ Movie scraping failed"
fi

# Test 4: PM2 Status
echo ""
echo "4️⃣ Testing PM2 Process Management..."
PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vegaxpixeldrain") | .pm2_env.status' 2>/dev/null)
if [ "$PM2_STATUS" = "online" ]; then
    echo "   ✅ PM2 process is online"
else
    echo "   ⚠️  PM2 process status: $PM2_STATUS"
fi

# Test 5: Cron Jobs
echo ""
echo "5️⃣ Testing Cron Job Setup..."
CRON_COUNT=$(crontab -l 2>/dev/null | grep -c "vegaxpixeldrain\|VegaXPixelDrain" || echo "0")
if [ "$CRON_COUNT" -gt 0 ]; then
    echo "   ✅ Found $CRON_COUNT cron jobs"
    echo "   📋 Cron jobs:"
    crontab -l 2>/dev/null | grep "vegaxpixeldrain\|VegaXPixelDrain" | sed 's/^/      /'
else
    echo "   ⚠️  No cron jobs found - run 'npm run setup-cron'"
fi

# Test 6: Log Directory
echo ""
echo "6️⃣ Testing Log Directory..."
if [ -d "logs" ]; then
    LOG_COUNT=$(ls -1 logs/*.log 2>/dev/null | wc -l)
    echo "   ✅ Logs directory exists with $LOG_COUNT log files"
else
    echo "   ⚠️  Logs directory not found - will be created on first automation run"
fi

# Test 7: Environment Configuration
echo ""
echo "7️⃣ Testing Environment Configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    echo "   📋 Configuration:"
    grep -E "^(PORT|HEADLESS_MODE|NODE_ENV)" .env | sed 's/^/      /' || echo "      No key variables found"
else
    echo "   ⚠️  .env file not found"
fi

# Summary
echo ""
echo "🎯 Test Summary:"
echo "================"
echo "✅ Basic functionality tests completed"
echo "🔧 If any tests failed, check the troubleshooting guide in VPS-SETUP.md"
echo ""
echo "🚀 Next Steps:"
echo "   1. Run 'npm run setup-cron' if cron jobs are missing"
echo "   2. Run 'npm run monitor' to see full dashboard"
echo "   3. Run './run-automation.sh' to test full automation"
echo ""
echo "📊 Your VegaXPixelDrain automation is ready!"