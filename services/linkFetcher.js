import { setupBrowser, closeBrowser } from './vegamovies.js';
import { uploadFileToPixelDrain } from './pixeldrain.js';
import { optimizeSystemForUploads, getSystemStats } from './systemOptimizer.js';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import colors from 'colors';

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
 * Handles the Cloudflare Turnstile CAPTCHA by waiting for it to complete automatically
 * @param {import('playwright').Page} page The page with the Cloudflare challenge.
 */
async function solveCloudflareTurnstile(page) {
    console.log('  - Cloudflare Turnstile detected. Waiting for automatic completion...');
    try {
        // Wait for the Turnstile to complete automatically (it usually does)
        await page.waitForTimeout(5000);

        // Check if the turnstile completed by looking for the response token
        const turnstileCompleted = await page.locator('input[name="cf-turnstile-response"]').getAttribute('value');

        if (turnstileCompleted && turnstileCompleted.length > 10) {
            console.log('  - ✅ Cloudflare Turnstile completed automatically');
            return true;
        } else {
            console.log('  - ⏳ Waiting longer for Turnstile completion...');
            await page.waitForTimeout(10000);
            return true; // Proceed anyway
        }
    } catch (error) {
        console.log(`  - ⚠️ Turnstile handling warning: ${error.message}`);
        return true; // Continue anyway
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
        console.log('  - Looking for download verification button...');

        // Wait for page to load completely
        await page.waitForTimeout(3000);

        // Look for the specific "Click to verify" button with multiple selectors
        const buttonSelectors = [
            'button#download-button',
            'button:has-text("Click to verify")',
            'button.btn-danger:has-text("Click to verify")',
            'button[type="submit"]:has-text("Click to verify")',
            '.vd button[type="submit"]'
        ];

        let verifyButton = null;
        let buttonFound = false;

        for (const selector of buttonSelectors) {
            try {
                verifyButton = page.locator(selector).first();
                if (await verifyButton.isVisible({ timeout: 2000 })) {
                    console.log(`  - ✅ Found verify button with selector: ${selector}`);
                    buttonFound = true;
                    break;
                }
            } catch (e) {
                console.log(`  - Selector ${selector} not found, trying next...`);
            }
        }

        if (!buttonFound) {
            console.log('  - ❌ No verify button found');
            return { success: false };
        }

        // Scroll button into view and wait
        await verifyButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);

        console.log('  - 🖱️ Clicking "Click to verify" button...');

        // Try different click methods
        try {
            // Method 1: Regular click
            await verifyButton.click({ timeout: 10000 });
            console.log('  - ✅ Regular click successful');
        } catch (clickError) {
            console.log('  - ⚠️ Regular click failed, trying force click...');
            try {
                // Method 2: Force click
                await verifyButton.click({ force: true, timeout: 10000 });
                console.log('  - ✅ Force click successful');
            } catch (forceError) {
                console.log('  - ⚠️ Force click failed, trying JavaScript click...');
                // Method 3: JavaScript click
                await page.evaluate(() => {
                    const btn = document.querySelector('#download-button') ||
                        document.querySelector('button:contains("Click to verify")') ||
                        document.querySelector('.vd button[type="submit"]');
                    if (btn) btn.click();
                });
                console.log('  - ✅ JavaScript click executed');
            }
        }

        // Step 2: Wait for and click the "Download Now" button with multiple retries
        console.log('  - Waiting for "Download Now" button to appear...');

        // Try multiple times with different selectors and longer waits
        const downloadButtonSelectors = [
            'div.btn.btn-danger:has-text("Download Now")',
            'div[onclick*="openInNewTab"]:has-text("Download Now")',
            '.btn-danger:has-text("Download Now")',
            'div:has-text("⚡ Download Now ⚡")',
            '[onclick*="vegamovies"]:has-text("Download Now")'
        ];

        let downloadButton = null;
        let downloadButtonFound = false;

        // Try up to 3 times with 3-second gaps
        for (let retry = 1; retry <= 3; retry++) {
            console.log(`  - Looking for download button (attempt ${retry}/3)...`);

            for (const selector of downloadButtonSelectors) {
                try {
                    downloadButton = page.locator(selector).first();
                    if (await downloadButton.isVisible({ timeout: 3000 })) {
                        console.log(`  - ✅ Found download button with selector: ${selector}`);
                        downloadButtonFound = true;
                        break;
                    }
                } catch (e) {
                    console.log(`  - Selector ${selector} not found, trying next...`);
                }
            }

            if (downloadButtonFound) {
                break;
            }

            if (retry < 3) {
                console.log(`  - Download button not found, waiting 3 seconds before retry...`);
                await page.waitForTimeout(3000);
            }
        }

        if (downloadButtonFound && downloadButton) {
            console.log('  - 🖱️ Clicking final "Download Now" button...');

            try {
                // Get the onclick URL before clicking (in case window closes fast)
                const onclickUrl = await downloadButton.evaluate(el => {
                    const onclick = el.getAttribute('onclick');
                    if (onclick && onclick.includes('openInNewTab')) {
                        const match = onclick.match(/openInNewTab\('([^']+)'\)/);
                        return match ? match[1] : null;
                    }
                    return null;
                });

                if (onclickUrl) {
                    console.log(`  - ✅ Extracted download URL from onclick: ${onclickUrl}`);
                    return { success: true, finalUrl: onclickUrl };
                }

                // If we couldn't extract URL, try clicking and listening for download
                const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
                await downloadButton.click({ force: true });

                const download = await downloadPromise;
                const finalUrl = download.url();
                const suggestedFilename = download.suggestedFilename();

                console.log(`  - 📁 File: ${suggestedFilename}`);
                console.log(`  - 🔗 Download URL: ${finalUrl}`);

                // Validate the URL
                if (finalUrl && (finalUrl.includes('pixeldrain.com') || finalUrl.includes('mediafire.com') || finalUrl.includes('fast-dl.lol') || finalUrl.includes('vgmlinks.lol') || finalUrl.includes('vegamovies'))) {
                    console.log(`  - ✅ Valid download URL detected: ${finalUrl}`);
                    return { success: true, finalUrl, download, suggestedFilename };
                } else {
                    console.log(`  - ⚠️ Unexpected download URL: ${finalUrl}`);
                    return { success: true, finalUrl, download, suggestedFilename };
                }

            } catch (downloadError) {
                console.log(`  - ⚠️ Download event failed: ${downloadError.message}`);

                // Try to get the current page URL as fallback
                const currentUrl = page.url();
                if (currentUrl && currentUrl !== 'about:blank') {
                    console.log(`  - Using current page URL as fallback: ${currentUrl}`);
                    return { success: true, finalUrl: currentUrl };
                }

                return { success: false };
            }
        } else {
            console.log("  - ⚠️ 'Download Now' button did not appear after 3 attempts.");
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
    console.log(`\n🎬 ${colors.cyan.bold('[LINK FETCHER]')} Starting professional movie processing...`);
    console.log(`📊 Found ${colors.yellow.bold(missingMovies.length)} missing movies to process\n`);

    // Optimize system for large file uploads
    optimizeSystemForUploads();

    let browser;
    const results = [];
    const startTime = Date.now();

    // Initialize progress bar
    const progressBar = new cliProgress.SingleBar({
        format: `${colors.cyan('Processing')} |${colors.cyan('{bar}')}| ${colors.yellow('{percentage}%')} | ${colors.green('{value}/{total}')} movies | ETA: {eta}s | {status}`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        clearOnComplete: false,
        stopOnComplete: true
    });

    try {
        ({ browser } = await setupBrowser());
        const context = browser;

        // Start progress bar
        progressBar.start(missingMovies.length, 0, { status: 'Initializing...' });

        for (let i = 0; i < missingMovies.length; i++) {
            const movie = missingMovies[i];
            const movieNumber = i + 1;

            // Update progress bar
            progressBar.update(i, {
                status: `Processing: ${movie.title.substring(0, 30)}${movie.title.length > 30 ? '...' : ''}`
            });

            console.log(`\n${colors.magenta.bold(`[${movieNumber}/${missingMovies.length}]`)} ${colors.white.bold('Processing:')} ${colors.cyan(movie.title)}`);

            const result = await processSingleMovie(context, movie);
            results.push(result);

            // Update progress with result
            const successCount = results.filter(r => r.status === 'success').length;
            const failedCount = results.length - successCount;

            progressBar.update(movieNumber, {
                status: `✅ ${successCount} success, ❌ ${failedCount} failed`
            });

            // Cleanup browser tabs before next movie
            if (movieNumber < missingMovies.length) {
                await cleanupBrowserTabs(context);
                console.log(`${colors.gray('⏳ Waiting 3 seconds before next movie...')}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Complete progress bar
        progressBar.stop();

        // Final statistics
        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);
        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.length - successCount;

        console.log(`\n${colors.green.bold('🎉 PROCESSING COMPLETE!')}`);
        console.log(`${colors.cyan('📊 Final Statistics:')}`);
        console.log(`   ${colors.green('✅ Successful:')} ${successCount}/${results.length}`);
        console.log(`   ${colors.red('❌ Failed:')} ${failedCount}/${results.length}`);
        console.log(`   ${colors.blue('⏱️  Total Time:')} ${totalTime} minutes`);
        console.log(`   ${colors.yellow('📈 Success Rate:')} ${((successCount / results.length) * 100).toFixed(1)}%`);

        // Show system stats
        const stats = getSystemStats();
        console.log(`\n${colors.gray('💻 System Stats:')}`);
        console.log(`   Memory: ${stats.freeMemory}/${stats.totalMemory} free`);
        console.log(`   Uptime: ${stats.uptime}\n`);

    } catch (error) {
        progressBar.stop();
        console.error(`\n${colors.red.bold('[LINK FETCHER]')} Critical error occurred:`, error);
    } finally {
        if (browser) {
            await closeBrowser(browser);
            console.log(`${colors.gray('🔒 Browser closed and resources cleaned up')}`);
        }
    }
    return results;
}

/**
 * Cleanup browser tabs and memory before processing next movie
 */
async function cleanupBrowserTabs(context) {
    try {
        const pages = context.pages();
        // Keep only the first page, close all others
        for (let i = 1; i < pages.length; i++) {
            if (!pages[i].isClosed()) {
                await pages[i].close();
            }
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        console.log(`${colors.gray('🧹 Cleaned up browser tabs and memory')}`);
    } catch (error) {
        console.log(`${colors.yellow('⚠️  Warning: Could not cleanup browser tabs:')}, ${error.message}`);
    }
}