#!/bin/bash

# GCP Deployment Script for VegaMovies to PixelDrain Automation

PROJECT_ID="your-gcp-project-id"
SERVICE_NAME="vegamovies-automation"
REGION="us-central1"

echo "🚀 Deploying VegaMovies Automation to Google Cloud Run..."

# Build and deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 1 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars PIXELDRAIN_API_KEY=$PIXELDRAIN_API_KEY \
  --project $PROJECT_ID

echo "✅ Deployment complete!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo "🔗 Service URL: $SERVICE_URL"

# Set up Cloud Scheduler for cron jobs
echo "⏰ Setting up automated scheduling..."

# Create scheduler job for 6 AM UTC (adjust timezone as needed)
gcloud scheduler jobs create http vegamovies-morning \
  --schedule="0 6 * * *" \
  --uri="$SERVICE_URL/movies" \
  --http-method=GET \
  --time-zone="UTC" \
  --project $PROJECT_ID

# Create scheduler job for 6 PM UTC
gcloud scheduler jobs create http vegamovies-evening \
  --schedule="0 18 * * *" \
  --uri="$SERVICE_URL/movies" \
  --http-method=GET \
  --time-zone="UTC" \
  --project $PROJECT_ID

# Create follow-up job for link fetching (runs 5 minutes after movies)
gcloud scheduler jobs create http vegamovies-links-morning \
  --schedule="5 6 * * *" \
  --uri="$SERVICE_URL/fetch-links" \
  --http-method=GET \
  --time-zone="UTC" \
  --project $PROJECT_ID

gcloud scheduler jobs create http vegamovies-links-evening \
  --schedule="5 18 * * *" \
  --uri="$SERVICE_URL/fetch-links" \
  --http-method=GET \
  --time-zone="UTC" \
  --project $PROJECT_ID

echo "✅ Automated scheduling configured!"
echo "📋 Summary:"
echo "   - Service deployed to: $SERVICE_URL"
echo "   - Runs daily at 6:00 AM and 6:00 PM UTC"
echo "   - Link fetching runs 5 minutes after each scraping job"