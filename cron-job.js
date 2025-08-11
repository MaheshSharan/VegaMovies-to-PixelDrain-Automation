#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runFullProcess() {
    try {
        console.log(`[${new Date().toISOString()}] Starting automated movie processing...`);
        
        // Step 1: Scrape and match movies
        console.log('Step 1: Scraping VegaMovies and matching with PixelDrain...');
        const moviesResponse = await axios.get(`${BASE_URL}/movies`);
        console.log(`✅ Found ${moviesResponse.data.missing_count} missing movies`);
        
        if (moviesResponse.data.missing_count === 0) {
            console.log('No missing movies to process. Exiting.');
            return;
        }
        
        // Step 2: Fetch download links and upload to PixelDrain
        console.log('Step 2: Fetching download links and uploading to PixelDrain...');
        const linksResponse = await axios.get(`${BASE_URL}/fetch-links`);
        console.log(`✅ Processed ${linksResponse.data.processed_count} movies`);
        
        console.log(`[${new Date().toISOString()}] Automated process completed successfully!`);
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in automated process:`, error.message);
        process.exit(1);
    }
}

runFullProcess();