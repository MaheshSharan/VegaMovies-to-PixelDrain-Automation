// uploadManager.js - Service selector for upload providers
import { getUploadedFiles as getPixelDrainFiles, splitMoviesByUploadStatus as splitPixelDrainMovies, uploadFileToPixelDrain } from './pixeldrain.js';
import { getUploadedFiles as getArchiveFiles, splitMoviesByUploadStatus as splitArchiveMovies, uploadFileToArchive, testArchiveConnection } from './archive.js';

// Get the selected upload service from environment (hardcoded for testing)
const UPLOAD_SERVICE = 'archive';

console.log(`[Upload Manager] Using service: ${UPLOAD_SERVICE}`);

// Validate service selection
if (!['pixeldrain', 'archive'].includes(UPLOAD_SERVICE)) {
    throw new Error(`Invalid UPLOAD_SERVICE: ${UPLOAD_SERVICE}. Must be 'pixeldrain' or 'archive'`);
}

// Unified interface for getting uploaded files
export async function getUploadedFiles() {
    try {
        if (UPLOAD_SERVICE === 'pixeldrain') {
            console.log('[Upload Manager] Fetching files from PixelDrain...');
            return await getPixelDrainFiles();
        } else if (UPLOAD_SERVICE === 'archive') {
            console.log('[Upload Manager] Fetching files from Internet Archive...');
            return await getArchiveFiles();
        }
    } catch (error) {
        console.error(`[Upload Manager] Failed to fetch files from ${UPLOAD_SERVICE}:`, error.message);
        throw error;
    }
}

// Unified interface for splitting movies by upload status
export function splitMoviesByUploadStatus(scrapedList, uploadedFiles) {
    if (UPLOAD_SERVICE === 'pixeldrain') {
        return splitPixelDrainMovies(scrapedList, uploadedFiles);
    } else if (UPLOAD_SERVICE === 'archive') {
        return splitArchiveMovies(scrapedList, uploadedFiles);
    }
}

// Unified interface for uploading files
export async function uploadFile(filePath, fileName, maxRetries = 3) {
    if (UPLOAD_SERVICE === 'pixeldrain') {
        console.log(`[Upload Manager] Uploading to PixelDrain: ${fileName}`);
        return await uploadFileToPixelDrain(filePath, fileName, maxRetries);
    } else if (UPLOAD_SERVICE === 'archive') {
        console.log(`[Upload Manager] Uploading to Internet Archive: ${fileName}`);
        return await uploadFileToArchive(filePath, fileName, maxRetries);
    }
}

// Test connection to the selected service
export async function testConnection() {
    if (UPLOAD_SERVICE === 'pixeldrain') {
        try {
            console.log('[Upload Manager] Testing PixelDrain connection...');
            await getPixelDrainFiles();
            console.log('[Upload Manager] ✅ PixelDrain connection successful');
            return true;
        } catch (error) {
            console.error('[Upload Manager] ❌ PixelDrain connection failed:', error.message);
            return false;
        }
    } else if (UPLOAD_SERVICE === 'archive') {
        return await testArchiveConnection();
    }
}

// Get service information
export function getServiceInfo() {
    return {
        service: UPLOAD_SERVICE,
        name: UPLOAD_SERVICE === 'pixeldrain' ? 'PixelDrain' : 'Internet Archive',
        collections: UPLOAD_SERVICE === 'archive' ? ['vegaxpixeldrain-movies', 'vegaxpixeldrain-tvshows'] : ['pixeldrain-files']
    };
}

// Health check for the upload service
export async function healthCheck() {
    try {
        const isConnected = await testConnection();
        const serviceInfo = getServiceInfo();
        
        return {
            service: serviceInfo.name,
            status: isConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            collections: serviceInfo.collections
        };
    } catch (error) {
        return {
            service: UPLOAD_SERVICE === 'pixeldrain' ? 'PixelDrain' : 'Internet Archive',
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}
