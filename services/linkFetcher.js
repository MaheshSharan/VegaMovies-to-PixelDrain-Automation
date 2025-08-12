import { setupBrowser, closeBrowser } from './vegamovies.js';
import { uploadFileToPixelDrain } from './pixeldrain.js';
import { optimizeSystemForUploads, getSystemStats } from './systemOptimizer.js';
import fs from 'fs';
import path from 'path';

// =================================================================================
// SECTION 1: VEGAMOVIES PAGE INTERACTION (YOUR CODE - PRESERVED)
// =================================================================================

async function smoothScrollToEnd(page) {
    console.log('  - Starting smooth scroll to load all content...');
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;

    while (previousHeight !== currentHeight && scrollAttempts < maxScrollAttempts) {
        previousHeight = currentHeight;
        await page.evaluate(() => { window.scrollBy({ top: 300, behavior: 'smooth' }); });
        await page.waitForTimeout(1000);
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        scrollAttempts++;
        console.log(`  - Scroll attempt ${scrollAttempts}: Height ${currentHeight}px`);
    }

    const reachedEnd = previousHeight === currentHeight;
    console.log(`  - ${reachedEnd ? '✅ Reached page end' : '⚠️ Max scroll attempts reached'}`);
    return reachedEnd;
}

async function findDownloadButton(page) {
    console.log('  - Searching for download buttons by priority...');
    const buttonSelectors = [
        { type: "G-Direct 720p", selector: 'h5:has-text("G-Direct") ~ h3:has-text("720p") + * a.btn' },
        { type: "Normal 720p", selector: '.download-links-div h3:has-text("720p") + * a.btn' },
        { type: "Any Download Button", selector: 'a.btn[href*="fast-dl"], a.btn[href*="vgmlinks"]' }
    ];

    for (const { type, selector } of buttonSelectors) {
        try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
                console.log(`  - ✅ Found button: ${type}`);
                return { element, type };
            }
        } catch (error) {
            console.log(`  - ℹ️ ${type} not found`);
        }
    }
    return null;
}

async function findBestDownloadLink(page) {
    console.log('  - Starting download link search process...');
    let buttonInfo = await findDownloadButton(page);
    if (buttonInfo) return buttonInfo;

    await smoothScrollToEnd(page);
    buttonInfo = await findDownloadButton(page);
    if (buttonInfo) return buttonInfo;

    console.log('  - No buttons found, waiting 5 seconds and trying final scroll...');
    await page.waitForTimeout(5000);
    await page.evaluate(() => { window.scrollBy({ top: 500, behavior: 'smooth' }); });
    await page.waitForTimeout(3000);

    buttonInfo = await findDownloadButton(page);
    if (buttonInfo) return buttonInfo;

    console.log('  - ❌ No download buttons found after all attempts');
    return null;
}

// =================================================================================
// SECTION 2: DOWNLOAD AND UPLOAD UTILITIES
// =================================================================================

/**
 * Downloads a file from browser download and saves it locally
 * @param {any} download Playwright download object
 * @param {string} movieTitle Movie title for folder organization
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function downloadFileLocally(download, movieTitle) {
    try {
        // Create downloads directory if it doesn't exist
        const downloadsDir = path.join(process.cwd(), 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Generate safe filename
        const suggestedName = download.suggestedFilename() || 'unknown_file';
        const safeMovieTitle = movieTitle.replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 50);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${safeMovieTitle}_${timestamp}_${suggestedName}`;
        const filePath = path.join(downloadsDir, fileName);

        console.log(`  - 💾 Downloading to: ${filePath}`);

        // Save the file
        await download.saveAs(filePath);

        // Verify file exists and has content
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`  - ✅ Download completed: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            return { success: true, filePath };
        } else {
            return { success: false, error: 'File was not saved properly' };
        }

    } catch (error) {
        console.error(`  - ❌ Download failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}



// =================================================================================
// SECTION 3: INTERMEDIATE PAGE HANDLING (NEW LOGIC INTEGRATED INTO YOUR STRUCTURE)
// =================================================================================

/**
 * Handles the Cloudflare Turnstile CAPTCHA by locating and clicking the checkbox.
 * @param {import('playwright').Page} page The page with the Cloudflare challenge.
 */
async function solveCloudflareTurnstile(page) {
    console.log('  - ☁️ Cloudflare Turnstile detected. Attempting to solve...');
    try {
        const iframe = page.frameLocator('iframe[src*="challenges.cloudflare.com"]');
        const checkbox = iframe.locator('input[type="checkbox"]');
        await checkbox.click({ timeout: 15000 });
        await page.waitForTimeout(3000); // Wait for the checkmark animation and validation.
        console.log('  - ✅ Cloudflare checkbox clicked.');
        return true;
    } catch (error) {
        console.error(`  - ❌ Failed to click Cloudflare checkbox: ${error.message}`);
        return false;
    }
}

/**
 * Clicks the final "Click to Verify" or "Download Now" button and waits for the download.
 * This function now handles the final step for BOTH fast-dl and vgmlinks.
 * @param {import('playwright').Page} page The intermediate download page.
 * @returns {Promise<{success: boolean, finalUrl?: string}>}
 */
async function handleFinalDownload(page, movieTitle) {
    try {
        // Step 1: Click "Click to verify" if it exists
        const verifyButton = page.locator('button:has-text("Click to verify")');
        if (await verifyButton.isVisible({ timeout: 5000 })) {
            await verifyButton.click();
            console.log('  - 🖱️ Clicked "Click to verify" button.');
            await page.waitForTimeout(5000); // Wait for the "Download Now" button to appear.
        }

        // Step 2: Click the "Download Now" button
        const downloadNowButton = page.locator('a .btn:has-text("Download Now")');
        if (await downloadNowButton.isVisible({ timeout: 5000 })) {
            console.log('  - 🖱️ Clicking final "Download Now" button...');

            // Listen for the download event to start
            const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
            await downloadNowButton.click({ force: true }); // Use force click to handle overlays

            const download = await downloadPromise;
            const finalUrl = download.url();
            const suggestedFilename = download.suggestedFilename();

            console.log(`  - 📁 File: ${suggestedFilename}`);
            console.log(`  - 🔗 Download URL: ${finalUrl}`);

            // Validate the URL
            if (finalUrl && (finalUrl.includes('pixeldrain.com') || finalUrl.includes('mediafire.com') || finalUrl.includes('fast-dl.lol') || finalUrl.includes('vgmlinks.lol'))) {
                console.log(`  - ✅ Valid download URL detected: ${finalUrl}`);
                return { success: true, finalUrl, download, suggestedFilename };
            } else {
                console.log(`  - ⚠️ Unexpected download URL: ${finalUrl}`);
                return { success: true, finalUrl, download, suggestedFilename };
            }
        } else {
            console.log("  - ⚠️ 'Download Now' button did not appear as expected.");
            return { success: false };
        }
    } catch (error) {
        console.error(`  - ❌ Error during final download button click: ${error.message}`);
        return { success: false };
    }
}


async function attemptDownloadWithRetries(context, page, buttonElement, buttonType, movie, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let newPage = null;

        try {
            console.log(`\n  - Attempt ${attempt}/${maxRetries}: Clicking ${buttonType} button...`);
            const newPagePromise = context.waitForEvent('page', { timeout: 30000 });
            await buttonElement.click({ force: true, timeout: 10000 });
            newPage = await newPagePromise;
            console.log('  - ✅ New tab opened. Loading intermediate page...');

            await newPage.waitForLoadState('domcontentloaded', { timeout: 20000 });
            console.log(`  - Intermediate page loaded: ${newPage.url()}`);

            // Check for Cloudflare Turnstile on the new page
            const isCloudflareVisible = await newPage.locator('iframe[src*="challenges.cloudflare.com"]').isVisible({ timeout: 5000 });
            if (isCloudflareVisible) {
                if (!await solveCloudflareTurnstile(newPage)) {
                    throw new Error("Failed to solve Cloudflare challenge.");
                }
            } else {
                console.log("  - No Cloudflare challenge detected.");
            }

            // Proceed to the final download steps
            const result = await handleFinalDownload(newPage, movie.title);

            if (result.success && result.download) {
                console.log('  - 🎯 Download link obtained, starting file download...');

                // Download the file locally
                const downloadResult = await downloadFileLocally(result.download, movie.title);

                if (downloadResult.success) {
                    console.log('  - 📁 File downloaded successfully, starting PixelDrain upload...');

                    // Upload to PixelDrain
                    const uploadResult = await uploadFileToPixelDrain(
                        downloadResult.filePath,
                        result.suggestedFilename || `${movie.title}.mp4`
                    );

                    await newPage.close();

                    if (uploadResult.success) {
                        return {
                            success: true,
                            url: result.finalUrl,
                            pixeldrainId: uploadResult.id,
                            pixeldrainUrl: uploadResult.url
                        };
                    } else {
                        return {
                            success: false,
                            error: `Download successful but upload failed: ${uploadResult.error}`,
                            downloadUrl: result.finalUrl
                        };
                    }
                } else {
                    await newPage.close();
                    return {
                        success: false,
                        error: `Could not download file: ${downloadResult.error}`,
                        downloadUrl: result.finalUrl
                    };
                }
            } else {
                throw new Error("Could not get the final download link from the intermediate page.");
            }

        } catch (error) {
            console.log(`  - ❌ Attempt ${attempt} failed: ${error.message}`);
            if (newPage && !newPage.isClosed()) await newPage.close();
            if (attempt < maxRetries) await page.waitForTimeout(3000);
        }
    }

    return { success: false, error: `Failed to get a download link after ${maxRetries} attempts.` };
}

// =================================================================================
// SECTION 4: MAIN ORCHESTRATION LOGIC (YOUR CODE - PRESERVED)
// =================================================================================

async function processSingleMovie(context, movie) {
    const movieResult = { ...movie, downloadLink: null, status: 'pending' };
    let page;

    try {
        console.log(`\n▶ Processing: "${movie.title}"`);
        page = await context.newPage();
        console.log(`  - Loading movie page: ${movie.url}`);
        await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        const buttonInfo = await findBestDownloadLink(page);
        if (!buttonInfo) {
            movieResult.status = 'no_link_found';
            return movieResult;
        }

        console.log(`  - Found ${buttonInfo.type} button, preparing to click...`);
        await buttonInfo.element.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);

        if (!await buttonInfo.element.isEnabled()) {
            console.log('  - ❌ Button is not clickable');
            movieResult.status = 'button_not_clickable';
            return movieResult;
        }

        const result = await attemptDownloadWithRetries(context, page, buttonInfo.element, buttonInfo.type, movie, 3);

        if (result.success) {
            movieResult.downloadLink = result.url;
            movieResult.pixeldrainId = result.pixeldrainId;
            movieResult.pixeldrainUrl = result.pixeldrainUrl;
            movieResult.status = 'success';
            console.log(`  - ✅ Successfully downloaded and uploaded to PixelDrain!`);
            console.log(`  - 🔗 PixelDrain URL: ${result.pixeldrainUrl}`);
        } else {
            movieResult.status = 'failed_after_retries';
            movieResult.error = result.error;
            movieResult.downloadLink = result.downloadUrl; // Include original download URL if available
            console.log(`  - ❌ Process failed: ${result.error}`);
        }

    } catch (error) {
        console.error(`  - ❌ Error processing "${movie.title}": ${error.message}`);
        movieResult.status = 'error';
        movieResult.error = error.message;
    } finally {
        if (page && !page.isClosed()) {
            try { await page.close(); } catch (e) { console.log('  - Warning: Could not close main page'); }
        }
    }
    return movieResult;
}

export async function getDownloadLinks(missingMovies) {
    console.log(`[LINK FETCHER] Starting process...`);
    console.log(`[LINK FETCHER] Found ${missingMovies.length} missing movies. Starting to fetch links...`);
    
    // Optimize system for large file uploads
    optimizeSystemForUploads();
    
    let browser;
    const results = [];

    try {
        ({ browser } = await setupBrowser());
        const context = browser;

        for (const movie of missingMovies) {
            const result = await processSingleMovie(context, movie);
            results.push(result);
            
            // Add delay between movies to avoid overwhelming the server
            if (results.length < missingMovies.length) {
                console.log('  - Waiting 5 seconds before next movie...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        console.log(`\n[LINK FETCHER] Completed processing ${results.length} movies`);
        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`[LINK FETCHER] Success rate: ${successCount}/${results.length}`);
    } catch (error) {
        console.error('[LINK FETCHER] Critical error occurred:', error);
    } finally {
        if (browser) {
            await closeBrowser(browser);
        }
    }
    return results;
}