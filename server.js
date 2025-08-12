import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from 'url';
import cors from 'cors';

import { scrapeVegaMovies } from "./services/vegamovies.js";
import { getUploadedFiles, splitMoviesByUploadStatus } from "./services/pixeldrain.js";
import { getDownloadLinks } from "./services/linkFetcher.js";

// Helper for getting __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

const dataPath = (fileName) => path.join(__dirname, 'data', fileName);

// Ensure data directory exists
await fs.ensureDir(path.join(__dirname, 'data'));

// API Routes
app.get("/api/v1/movies", async (req, res) => {
    try {
        console.log("[STEP 1] Scraping VegaMovies...");
        const scraped = await scrapeVegaMovies();

        console.log("[STEP 2] Fetching PixelDrain uploads...");
        const uploadedFiles = await getUploadedFiles();

        console.log("[STEP 3] Matching titles...");
        const { uploaded, missing } = splitMoviesByUploadStatus(scraped, uploadedFiles);

        console.log(`[RESULT] Uploaded: ${uploaded.length}, Missing: ${missing.length}`);

        console.log("[STEP 4] Generating JSON files...");
        await fs.writeJson(dataPath('missing_movies.json'), missing, { spaces: 2 });
        console.log(`✅ Generated missing_movies.json with ${missing.length} movies`);

        await fs.writeJson(dataPath('uploaded_movies.json'), uploaded, { spaces: 2 });
        console.log(`✅ Generated uploaded_movies.json with ${uploaded.length} movies`);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                uploaded_count: uploaded.length,
                missing_count: missing.length,
                total_scraped: scraped.length,
                uploaded_movies: uploaded,
                missing_movies: missing
            },
            meta: {
                version: "1.0.0",
                environment: NODE_ENV
            }
        });
    } catch (err) {
        console.error("Error in /api/v1/movies endpoint:", err.message);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch and match movie list",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get("/api/v1/fetch-links", async (req, res) => {
    try {
        console.log("\n[LINK FETCHER] Starting process...");
        const missingMoviesPath = dataPath('missing_movies.json');

        if (!await fs.pathExists(missingMoviesPath)) {
            return res.status(404).json({ 
                success: false,
                error: 'missing_movies.json not found. Please run the /api/v1/movies endpoint first.',
                timestamp: new Date().toISOString()
            });
        }

        const missingMovies = await fs.readJson(missingMoviesPath);
        if (missingMovies.length === 0) {
            return res.status(200).json({ 
                success: true,
                message: 'No missing movies to process.',
                data: { processed_count: 0, results: [] },
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[LINK FETCHER] Found ${missingMovies.length} missing movies. Starting to fetch links...`);
        const moviesWithLinks = await getDownloadLinks(missingMovies);

        await fs.writeJson(dataPath('movies_with_links.json'), moviesWithLinks, { spaces: 2 });
        console.log(`[LINK FETCHER] ✅ Process complete. Saved results to movies_with_links.json`);

        const successCount = moviesWithLinks.filter(m => m.status === 'success').length;
        const failedCount = moviesWithLinks.length - successCount;

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                processed_count: moviesWithLinks.length,
                success_count: successCount,
                failed_count: failedCount,
                results: moviesWithLinks
            },
            meta: {
                version: "1.0.0",
                environment: NODE_ENV
            }
        });

    } catch (err) {
        console.error("Error in /api/v1/fetch-links endpoint:", err.message);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch download links",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Combined endpoint for full automation
app.get("/api/v1/process-all", async (req, res) => {
    try {
        console.log("\n[AUTOMATION] Starting full movie processing pipeline...");
        
        // Step 1: Scrape and match
        console.log("[STEP 1] Scraping VegaMovies...");
        const scraped = await scrapeVegaMovies();
        
        console.log("[STEP 2] Fetching PixelDrain uploads...");
        const uploadedFiles = await getUploadedFiles();
        
        console.log("[STEP 3] Matching titles...");
        const { uploaded, missing } = splitMoviesByUploadStatus(scraped, uploadedFiles);
        
        // Save intermediate results
        await fs.writeJson(dataPath('missing_movies.json'), missing, { spaces: 2 });
        await fs.writeJson(dataPath('uploaded_movies.json'), uploaded, { spaces: 2 });
        
        if (missing.length === 0) {
            return res.json({
                success: true,
                message: "No missing movies to process",
                data: { uploaded_count: uploaded.length, missing_count: 0 },
                timestamp: new Date().toISOString()
            });
        }
        
        // Step 2: Process missing movies
        console.log(`[STEP 4] Processing ${missing.length} missing movies...`);
        const processedMovies = await getDownloadLinks(missing);
        
        await fs.writeJson(dataPath('movies_with_links.json'), processedMovies, { spaces: 2 });
        
        const successCount = processedMovies.filter(m => m.status === 'success').length;
        const failedCount = processedMovies.length - successCount;
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                total_scraped: scraped.length,
                already_uploaded: uploaded.length,
                processed_missing: processedMovies.length,
                successful_uploads: successCount,
                failed_uploads: failedCount,
                results: processedMovies
            },
            meta: {
                version: "1.0.0",
                environment: NODE_ENV,
                processing_time: "See logs for detailed timing"
            }
        });
        
    } catch (err) {
        console.error("Error in /api/v1/process-all endpoint:", err.message);
        res.status(500).json({ 
            success: false,
            error: "Failed to process movies",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: NODE_ENV,
        port: PORT
    });
});

// API documentation endpoint
app.get("/api/v1/docs", (req, res) => {
    res.json({
        title: "VegaXPixelDrain API",
        version: "1.0.0",
        description: "Automated movie scraping and upload service",
        endpoints: {
            "GET /health": "Health check",
            "GET /api/v1/movies": "Scrape movies and match with PixelDrain",
            "GET /api/v1/fetch-links": "Process missing movies and upload to PixelDrain",
            "GET /api/v1/process-all": "Complete automation pipeline",
            "GET /api/v1/docs": "This documentation"
        },
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Endpoint not found",
        message: `${req.method} ${req.path} is not a valid endpoint`,
        available_endpoints: ["/health", "/api/v1/movies", "/api/v1/fetch-links", "/api/v1/process-all", "/api/v1/docs"],
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 VegaXPixelDrain API Server Started`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   API Docs: http://localhost:${PORT}/api/v1/docs`);
    console.log(`\n📋 Available Endpoints:`);
    console.log(`   GET /api/v1/movies - Scrape and match movies`);
    console.log(`   GET /api/v1/fetch-links - Process missing movies`);
    console.log(`   GET /api/v1/process-all - Full automation pipeline`);
    console.log(`\n⚡ Ready for requests!\n`);
});