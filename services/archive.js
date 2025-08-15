// archive.js - Internet Archive S3-compatible API integration
import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import stringSimilarity from 'string-similarity';

// Environment variables (hardcoded for testing)
const ACCESS_KEY = 't7KE6ywXUPldLwXs';
const SECRET_KEY = 'gN1pCIafrHJjstXc';
const USERNAME = 'starlight723';
const MOVIES_COLLECTION = 'vegaxpixeldrain-movies';
const TVSHOWS_COLLECTION = 'vegaxpixeldrain-tvshows';

// Validate required environment variables
if (!ACCESS_KEY || !SECRET_KEY || !USERNAME) {
    throw new Error('Internet Archive credentials not configured. Please set ARCHIVE_ACCESS_KEY, ARCHIVE_SECRET_KEY, and ARCHIVE_USERNAME in .env');
}

// S3 Client for Internet Archive
const s3Client = new S3Client({
    region: 'us-east-1', // Internet Archive uses us-east-1
    endpoint: 'https://s3.us.archive.org',
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY
    },
    forcePathStyle: true, // Required for Internet Archive
    maxAttempts: 3,
    requestHandler: {
        httpOptions: {
            timeout: 300000, // 5 minutes for large files
            connectTimeout: 60000
        }
    }
});

// Custom request handler to add Internet Archive specific headers
const originalRequestHandler = s3Client.config.requestHandler;
s3Client.config.requestHandler = {
    ...originalRequestHandler,
    httpOptions: {
        ...originalRequestHandler?.httpOptions,
        timeout: 300000,
        connectTimeout: 60000
    }
};

// Detect content type (movie vs TV show)
function detectContentType(title) {
    const tvShowPatterns = [
        /\b(season|s\d+|episode|ep\d+|e\d+)\b/i,
        /\bs\d{1,2}e\d{1,2}\b/i,
        /\bepisode\s*\d+\b/i,
        /\bseason\s*\d+\b/i
    ];
    
    return tvShowPatterns.some(pattern => pattern.test(title)) ? 'tvshow' : 'movie';
}

// Extract metadata from title
function extractMetadata(title) {
    const metadata = {
        title: title,
        year: null,
        quality: null,
        language: null,
        format: null,
        cleanTitle: title
    };
    
    // Extract year
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
        metadata.year = yearMatch[0];
        metadata.cleanTitle = metadata.cleanTitle.replace(yearMatch[0], '').trim();
    }
    
    // Extract quality
    const qualityMatch = title.match(/\b(480p|720p|1080p|2160p|4k|hdtc|hdts|hdrip|webrip|web-dl|bluray|dvdrip)\b/i);
    if (qualityMatch) {
        metadata.quality = qualityMatch[0].toLowerCase();
        metadata.cleanTitle = metadata.cleanTitle.replace(qualityMatch[0], '').trim();
    }
    
    // Extract language
    const languageMatch = title.match(/\b(hindi|english|dual\s*audio|org|line)\b/i);
    if (languageMatch) {
        metadata.language = languageMatch[0].toLowerCase();
        metadata.cleanTitle = metadata.cleanTitle.replace(languageMatch[0], '').trim();
    }
    
    // Extract format
    const formatMatch = title.match(/\b(bluray|webrip|hdtv|dvdrip|web-dl)\b/i);
    if (formatMatch) {
        metadata.format = formatMatch[0].toLowerCase();
        metadata.cleanTitle = metadata.cleanTitle.replace(formatMatch[0], '').trim();
    }
    
    // Clean up title
    metadata.cleanTitle = metadata.cleanTitle
        .replace(/[\.\_\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    return metadata;
}

// Generate rich metadata for Internet Archive
function generateArchiveMetadata(title, contentType) {
    const metadata = extractMetadata(title);
    const uploadDate = new Date().toISOString().split('T')[0];
    
    // Create a single-line description without newlines or special characters
    const description = `Movie: ${metadata.cleanTitle}${metadata.year ? ` (${metadata.year})` : ''} | Quality: ${metadata.quality || 'Unknown'} | Language: ${metadata.language || 'Unknown'} | Format: ${metadata.format || 'Unknown'} | Source: VegaXPixelDrain Automation | Upload Date: ${uploadDate} | Uploader: ${USERNAME}`;
    
    const archiveMetadata = {
        title: metadata.cleanTitle,
        description: description,
        subject: [
            'vegaxpixeldrain',
            'automated-upload',
            contentType,
            metadata.quality,
            metadata.language,
            metadata.format
        ].filter(Boolean).join(','),
        creator: USERNAME,
        date: uploadDate,
        collection: contentType === 'tvshow' ? TVSHOWS_COLLECTION : MOVIES_COLLECTION,
        mediatype: 'movies',
        licenseurl: 'http://creativecommons.org/licenses/publicdomain/',
        publicdate: uploadDate
    };
    
    if (metadata.year) {
        archiveMetadata.year = metadata.year;
    }
    
    return archiveMetadata;
}

// Normalize file names for better matching (same as PixelDrain)
function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[\.\_\-]/g, " ")
        .replace(/\b(480p|720p|1080p|2160p|4k|hdtc|hdts|hdrip|webrip|web-dl|bluray|dvdrip)\b/g, "")
        .replace(/\b(hindi|dual audio|org|line|x264|x265|hevc|aac|mp3|mkv|mp4|webm|mov)\b/g, "")
        .replace(/\b(season|s\d+|e\d+|episode)\b/g, "")
        .replace(/\b\d{4}\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Fetch uploaded files from Internet Archive
export async function getUploadedFiles() {
    try {
        console.log("[Internet Archive] Fetching uploaded files...");
        
        const allFiles = [];
        
        // Fetch from both collections
        const collections = [MOVIES_COLLECTION, TVSHOWS_COLLECTION];
        
        for (const collection of collections) {
            try {
                const command = new ListObjectsV2Command({
                    Bucket: collection,
                    MaxKeys: 1000
                });
                
                const response = await s3Client.send(command);
                
                if (response.Contents) {
                    const files = response.Contents.map(item => ({
                        name: item.Key,
                        size: item.Size,
                        lastModified: item.LastModified,
                        collection: collection
                    }));
                    
                    allFiles.push(...files);
                    console.log(`[Internet Archive] Found ${files.length} files in ${collection}`);
                }
            } catch (error) {
                console.log(`[Internet Archive] Could not fetch from ${collection}: ${error.message}`);
            }
        }
        
        console.log(`[Internet Archive] Total files found: ${allFiles.length}`);
        return allFiles;
        
    } catch (error) {
        console.error("[Internet Archive] Failed to fetch files:", error.message);
        throw error;
    }
}

// Split scraped movies into uploaded & missing arrays (same logic as PixelDrain)
export function splitMoviesByUploadStatus(scrapedList, uploadedFiles) {
    const uploadedNames = uploadedFiles.map(f => ({
        raw: f.name,
        norm: normalizeName(f.name),
        collection: f.collection
    }));

    const uploaded = [];
    const missing = [];

    // If no uploaded files, all scraped items are missing
    if (uploadedNames.length === 0) {
        return { uploaded: [], missing: scrapedList };
    }

    scrapedList.forEach(item => {
        const normTitle = normalizeName(item.title);
        const contentType = detectContentType(item.title);

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

        if (finalScore > 0.45) {
            uploaded.push({
                ...item,
                matchedFile: uploadedNames[bestIndex].raw,
                matchScore: finalScore.toFixed(3),
                collection: uploadedNames[bestIndex].collection
            });
        } else {
            missing.push(item);
        }
    });

    return { uploaded, missing };
}

// Upload file to Internet Archive
export async function uploadFileToArchive(filePath, fileName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`  - 📤 Uploading to Internet Archive (Attempt ${attempt}/${maxRetries}): ${fileName}`);
            
            // Get file stats
            const fileStats = fs.statSync(filePath);
            const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
            console.log(`  - 📊 File size: ${fileSizeMB} MB`);
            
            // Detect content type and determine collection
            const contentType = detectContentType(fileName);
            const collection = contentType === 'tvshow' ? TVSHOWS_COLLECTION : MOVIES_COLLECTION;
            
            console.log(`  - 📁 Uploading to collection: ${collection}`);
            
            // Generate metadata
            const metadata = generateArchiveMetadata(fileName, contentType);
            
            // Create file stream
            const fileStream = fs.createReadStream(filePath);
            
            // Use simple PUT command without complex metadata for now
            const uploadCommand = new PutObjectCommand({
                Bucket: collection,
                Key: fileName,
                Body: fileStream,
                ContentType: 'application/octet-stream'
            });
            
            let lastProgress = 0;
            const startTime = Date.now();
            
            // Upload with progress tracking
            const response = await s3Client.send(uploadCommand);
            
            const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`  - ✅ Upload successful! Upload time: ${uploadTime}s`);
            
            // Generate archive.org URL
            const archiveUrl = `https://archive.org/details/${collection}/${encodeURIComponent(fileName)}`;
            console.log(`  - 🔗 Archive.org URL: ${archiveUrl}`);
            
            // Clean up local file after successful upload
            try {
                fs.unlinkSync(filePath);
                console.log(`  - 🗑️ Local file cleaned up`);
            } catch (cleanupError) {
                console.log(`  - ⚠️ Could not delete local file: ${cleanupError.message}`);
            }
            
            return { 
                success: true, 
                id: fileName,
                url: archiveUrl,
                collection: collection,
                metadata: metadata
            };
            
        } catch (error) {
            console.error(`  - ❌ Upload attempt ${attempt} failed: ${error.message}`);
            
            // Check if it's a retryable error
            if (error.name === 'NetworkError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                console.log(`  - 🔄 Network error detected, waiting before retry...`);
                if (attempt < maxRetries) {
                    const waitTime = attempt * 10000; // 10s, 20s, 30s
                    console.log(`  - ⏳ Waiting ${waitTime/1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
            
            // If it's the last attempt or a non-retryable error, return failure
            if (attempt === maxRetries) {
                return { 
                    success: false, 
                    error: `Upload failed after ${maxRetries} attempts: ${error.message}` 
                };
            }
            
            // Wait before retry for other errors
            console.log(`  - ⏳ Waiting 5 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    return { 
        success: false, 
        error: `Upload failed after ${maxRetries} attempts` 
    };
}

// Test Internet Archive connection
export async function testArchiveConnection() {
    try {
        console.log("[Internet Archive] Testing connection...");
        
        // Try to list objects from movies collection
        const command = new ListObjectsV2Command({
            Bucket: MOVIES_COLLECTION,
            MaxKeys: 1
        });
        
        await s3Client.send(command);
        console.log("[Internet Archive] ✅ Connection successful");
        return true;
        
    } catch (error) {
        // If bucket doesn't exist, that's okay - it will be created on first upload
        if (error.message.includes('does not exist')) {
            console.log("[Internet Archive] ✅ Connection successful (collections will be created on first upload)");
            return true;
        }
        console.error("[Internet Archive] ❌ Connection failed:", error.message);
        return false;
    }
}
