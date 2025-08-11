// pixeldrain.js
import axios from "axios";
import https from "https";
import fs from "fs";
import stringSimilarity from "string-similarity";

// Your PixelDrain API key
const API_KEY = "72aa4d30-a56a-4867-97e0-4959b55c75bb";
if (!API_KEY) throw new Error("PIXELDRAIN_API_KEY not set in environment");

// Force IPv4 to avoid ETIMEDOUT on IPv6-only routes
const httpsAgent = new https.Agent({ family: 4 });

// Normalize movie/file names for better matching
function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[\.\_\-]/g, " ") // replace separators with space
        .replace(/\b(480p|720p|1080p|2160p|4k|hdtc|hdts|hdrip|webrip|web-dl|bluray|dvdrip)\b/g, "")
        .replace(/\b(hindi|dual audio|org|line|x264|x265|hevc|aac|mp3|mkv|mp4|webm|mov)\b/g, "")
        .replace(/\b(season|s\d+|e\d+|episode)\b/g, "") // remove episode tags
        .replace(/\b\d{4}\b/g, "") // remove standalone years
        .replace(/\s+/g, " ") // collapse spaces
        .trim();
}

// Fetch uploaded files list from PixelDrain
export async function getUploadedFiles() {
    try {
        console.log("[PixelDrain] Testing API key:", API_KEY.substring(0, 8) + "...");

        // Create a fresh axios instance to avoid any global interceptors
        const axiosInstance = axios.create({
            timeout: 30000,
            httpsAgent: new https.Agent({ family: 4 }),
            headers: {
                'Authorization': 'Basic ' + Buffer.from(':' + API_KEY).toString('base64'),
                'User-Agent': 'VegaXPixelDrain/1.0',
                'Accept': 'application/json'
            }
        });

        const resp = await axiosInstance.get("https://pixeldrain.com/api/user/files");
        console.log("[PixelDrain] Successfully fetched files:", resp.data.files?.length || 0);
        return resp.data.files || [];
    } catch (err) {
        console.error("[PixelDrain] Failed to fetch files:", err.message);
        if (err.response) {
            console.error("[PixelDrain] Response status:", err.response.status);
            console.error("[PixelDrain] Response data:", err.response.data);
        }
        throw err;
    }
}

// Split scraped movies into uploaded & missing arrays
export function splitMoviesByUploadStatus(scrapedList, uploadedFiles) {
    const uploadedNames = uploadedFiles.map(f => ({
        raw: f.name,
        norm: normalizeName(f.name)
    }));

    const uploaded = [];
    const missing = [];

    scrapedList.forEach(item => {
        const normTitle = normalizeName(item.title);

        // String similarity match
        const match = stringSimilarity.findBestMatch(
            normTitle,
            uploadedNames.map(u => u.norm)
        );

        const bestIndex = match.bestMatchIndex;
        const bestScore = match.bestMatch.rating;

        // Token overlap score
        const titleTokens = new Set(normTitle.split(" "));
        const fileTokens = new Set(uploadedNames[bestIndex]?.norm.split(" ") || []);
        const tokenIntersection = [...titleTokens].filter(t => fileTokens.has(t));
        const tokenScore = tokenIntersection.length / Math.max(titleTokens.size, 1);

        // Weighted final score
        const finalScore = (bestScore * 0.65) + (tokenScore * 0.35);

        if (finalScore > 0.45) { // tweak threshold here
            uploaded.push({
                ...item,
                matchedFile: uploadedNames[bestIndex].raw,
                matchScore: finalScore.toFixed(3)
            });
        } else {
            missing.push(item);
        }
    });

    return { uploaded, missing };
}

// Upload a file to PixelDrain
export async function uploadFileToPixelDrain(filePath, fileName) {
    try {
        console.log(`  - 📤 Uploading to PixelDrain: ${fileName}`);
        
        // Read file and get stats
        const fileBuffer = fs.readFileSync(filePath);
        const fileStats = fs.statSync(filePath);
        
        console.log(`  - 📊 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Create axios instance with proper configuration
        const axiosInstance = axios.create({
            timeout: 300000, // 5 minutes for large files
            httpsAgent: new https.Agent({ family: 4 }),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'Authorization': 'Basic ' + Buffer.from(':' + API_KEY).toString('base64'),
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileStats.size,
                'User-Agent': 'VegaXPixelDrain/1.0'
            }
        });
        
        // Upload with progress tracking
        const response = await axiosInstance.put(
            `https://pixeldrain.com/api/file/${encodeURIComponent(fileName)}`,
            fileBuffer,
            {
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    if (percentCompleted % 10 === 0) { // Log every 10%
                        console.log(`  - 📤 Upload progress: ${percentCompleted}%`);
                    }
                }
            }
        );
        
        if (response.status === 201 && response.data.id) {
            console.log(`  - ✅ Upload successful! PixelDrain ID: ${response.data.id}`);
            console.log(`  - 🔗 PixelDrain URL: https://pixeldrain.com/u/${response.data.id}`);
            
            // Clean up local file after successful upload
            try {
                fs.unlinkSync(filePath);
                console.log(`  - 🗑️ Local file cleaned up`);
            } catch (cleanupError) {
                console.log(`  - ⚠️ Could not delete local file: ${cleanupError.message}`);
            }
            
            return { 
                success: true, 
                id: response.data.id, 
                url: `https://pixeldrain.com/u/${response.data.id}` 
            };
        } else {
            return { 
                success: false, 
                error: `Unexpected response: ${response.status}` 
            };
        }
        
    } catch (error) {
        console.error(`  - ❌ Upload failed: ${error.message}`);
        if (error.response) {
            console.error(`  - Response status: ${error.response.status}`);
            console.error(`  - Response data:`, error.response.data);
        }
        return { 
            success: false, 
            error: error.message 
        };
    }
}
