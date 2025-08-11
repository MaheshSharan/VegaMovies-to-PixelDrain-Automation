import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from 'url';

import { scrapeVegaMovies } from "./services/vegamovies.js";
import { getUploadedFiles, splitMoviesByUploadStatus } from "./services/pixeldrain.js";
import { getDownloadLinks } from "./services/linkFetcher.js";

// Helper for getting __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const dataPath = (fileName) => path.join(__dirname, 'data', fileName);

app.get("/movies", async (req, res) => {
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
            uploaded_count: uploaded.length,
            missing_count: missing.length,
            uploaded,
            missing
        });
    } catch (err) {
        console.error("Error in /movies endpoint:", err.message);
        res.status(500).json({ error: "Failed to fetch and match movie list" });
    }
});

app.get("/fetch-links", async (req, res) => {
    try {
        console.log("\n[LINK FETCHER] Starting process...");
        const missingMoviesPath = dataPath('missing_movies.json');

        if (!await fs.pathExists(missingMoviesPath)) {
            return res.status(404).json({ error: 'missing_movies.json not found. Please run the /movies endpoint first.' });
        }

        const missingMovies = await fs.readJson(missingMoviesPath);
        if (missingMovies.length === 0) {
            return res.status(200).json({ message: 'No missing movies to process.' });
        }

        console.log(`[LINK FETCHER] Found ${missingMovies.length} missing movies. Starting to fetch links...`);
        const moviesWithLinks = await getDownloadLinks(missingMovies);

        await fs.writeJson(dataPath('movies_with_links.json'), moviesWithLinks, { spaces: 2 });
        console.log(`[LINK FETCHER] ✅ Process complete. Saved results to movies_with_links.json`);

        res.status(200).json({
            success: true,
            processed_count: moviesWithLinks.length,
            results: moviesWithLinks
        });

    } catch (err) {
        console.error("Error in /fetch-links endpoint:", err.message);
        res.status(500).json({ error: "Failed to fetch download links." });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Server running. Endpoints:`);
    console.log(`   - http://localhost:${PORT}/movies (Run this first)`);
    console.log(`   - http://localhost:${PORT}/fetch-links (Run this second)`);
    console.log(`   - http://localhost:${PORT}/health (Health check)`);
});