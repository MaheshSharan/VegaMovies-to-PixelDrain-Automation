import { setupBrowser, closeBrowser } from './vegamovies.js';
import { uploadFile } from './uploadManager.js';
import { optimizeSystemForUploads, getSystemStats } from './systemOptimizer.js';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import colors from 'colors';
import axios from 'axios';

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
// SECTION 2: DOWNLOAD AND UPLOAD UTILITIES (FILENAME LOGIC FIXED)
// =================================================================================

/**
 * Downloads a file from a URL using axios and saves it locally with a safe filename.
 * @param {string} url The URL of the file to download.
 * @param {string} movieTitle The original movie title string.
 * @param {import('playwright').Page} page The page object to get cookies from.
 * @returns {Promise<{success: boolean, filePath?: string, error?: string, fileName?: string}>}
 */
async function downloadFileLocally(url, movieTitle, page) {
    // *** THE KEY FIX IS HERE: Smart and safe filename generation ***
    try {
        const downloadsDir = path.join(process.cwd(), 'downloads');
        fs.mkdirSync(downloadsDir, { recursive: true });

        // 1. Sanitize the movie title for the filename
        const sanitizedTitle = movieTitle
            .replace(/\[.*?\]/g, '') // Remove content in brackets like [Hindi]
            .replace(/[^a-zA-Z0-9\s-]/g, ' ') // Remove non-alphanumeric characters
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim()
            .substring(0, 100); // Truncate to a safe length

        // 2. Intelligently find the file extension from the original title, default to .mp4
        const extensionMatch = movieTitle.match(/\.(mkv|mp4|avi)$/i);
        const extension = extensionMatch ? extensionMatch[0] : '.mp4';
        
        const fileName = `${sanitizedTitle}${extension}`;
        const filePath = path.join(downloadsDir, fileName);

        console.log(`  - 💾 Preparing to download from URL...`);
        console.log(`  - 💾 Saving to clean filename: ${fileName}`);

        const cookies = await page.context().cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: { 'Cookie': cookieString, 'Referer': page.url() }
        });

        const writer = fs.createWriteStream(filePath);
        const totalSize = parseInt(response.headers['content-length'] || '0');
        let downloadedSize = 0;
        const startTime = Date.now();

        // Create progress bar
        const progressBar = new cliProgress.SingleBar({
            format: '  - 📥 Downloading |{bar}| {percentage}% | {value}/{total} MB | ETA: {eta}s | Speed: {speed} MB/s',
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true,
            clearOnComplete: true
        });

        if (totalSize > 0) {
            progressBar.start(totalSize / (1024 * 1024), 0);
        }

        // Track download progress
        response.data.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
                progressBar.update(downloadedSize / (1024 * 1024));
            }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', () => {
                if (totalSize > 0) {
                    progressBar.stop();
                }
                resolve();
            });
            writer.on('error', reject);
        });

        const stats = fs.statSync(filePath);
        console.log(`  - ✅ Download completed: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        return { success: true, filePath, fileName };

    } catch (error) {
        console.error(`  - ❌ Download failed: ${error.message}`);
        // Check specifically for ENAMETOOLONG just in case, though it shouldn't happen now
        if (error.code === 'ENAMETOOLONG') {
            return { success: false, error: 'Generated filename was still too long for the OS.' };
        }
        return { success: false, error: error.message };
    }
}

// =================================================================================
// SECTION 3: INTERMEDIATE PAGE HANDLING (YOUR CODE - PRESERVED)
// =================================================================================

async function solveCloudflareTurnstile(page) {
    console.log('  - ☁️ Cloudflare Turnstile detected. Waiting for automatic completion...');
    try {
        await page.waitForTimeout(5000);
        const turnstileCompleted = await page.locator('input[name="cf-turnstile-response"]').getAttribute('value');
        if (turnstileCompleted && turnstileCompleted.length > 10) {
            console.log('  - ✅ Cloudflare Turnstile completed automatically');
            return true;
        }
        console.log('  - ⏳ Waiting longer for Turnstile completion...');
        await page.waitForTimeout(10000);
        return true;
    } catch (error) {
        console.log(`  - ⚠️ Turnstile handling warning: ${error.message}`);
        return true;
    }
}

async function handleFinalDownload(page) {
    try {
        console.log('  - Looking for download verification button...');
        const verifyButton = page.locator('button#download-button, button:has-text("Click to verify")').first();
        await verifyButton.waitFor({ state: 'visible', timeout: 10000 });
        console.log('  - ✅ Found verify button.');
        await verifyButton.click({ force: true });
        console.log('  - 🖱️ Clicked "Click to verify". Waiting for download link to appear...');

        const downloadLinkElement = page.locator('a#vd[href*="googleusercontent.com"]');
        await downloadLinkElement.waitFor({ state: 'visible', timeout: 15000 });

        const finalUrl = await downloadLinkElement.getAttribute('href');
        if (finalUrl) {
            console.log(`  - ✅ Extracted final download link from href.`);
            return { success: true, finalUrl };
        } else {
            throw new Error("Found download link element but could not extract href.");
        }
    } catch (error) {
        console.error(`  - ❌ Error during final download handling: ${error.message}`);
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

            const isCloudflareVisible = await newPage.locator('iframe[src*="challenges.cloudflare.com"]').isVisible({ timeout: 5000 });
            if (isCloudflareVisible) {
                if (!await solveCloudflareTurnstile(newPage)) throw new Error("Failed to solve Cloudflare challenge.");
            } else {
                console.log("  - No Cloudflare challenge detected.");
            }
            
            const result = await handleFinalDownload(newPage);

            if (result.success && result.finalUrl) {
                const downloadResult = await downloadFileLocally(result.finalUrl, movie.title, newPage);
                if (downloadResult.success) {
                    const uploadResult = await uploadFile(downloadResult.filePath, downloadResult.fileName);
                    if (uploadResult.success) {
                        return { success: true, url: result.finalUrl, uploadId: uploadResult.id, uploadUrl: uploadResult.url };
                    } else {
                        throw new Error(`Upload failed: ${uploadResult.error}`);
                    }
                } else {
                    throw new Error(`Local download failed: ${downloadResult.error}`);
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
    return { success: false, error: `Failed after ${maxRetries} attempts.` };
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
            movieResult.uploadId = result.uploadId;
            movieResult.uploadUrl = result.uploadUrl;
            movieResult.status = 'success';
            console.log(`  - ✅ Successfully downloaded and uploaded!`);
            console.log(`  - 🔗 Upload URL: ${result.uploadUrl}`);
        } else {
            movieResult.status = 'failed_after_retries';
            movieResult.error = result.error;
            movieResult.downloadLink = result.downloadUrl;
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
    optimizeSystemForUploads();
    let browser;
    const results = [];
    const startTime = Date.now();
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
        progressBar.start(missingMovies.length, 0, { status: 'Initializing...' });
        for (let i = 0; i < missingMovies.length; i++) {
            const movie = missingMovies[i];
            const movieNumber = i + 1;
            progressBar.update(i, { status: `Processing: ${movie.title.substring(0, 30)}${movie.title.length > 30 ? '...' : ''}` });
            console.log(`\n${colors.magenta.bold(`[${movieNumber}/${missingMovies.length}]`)} ${colors.white.bold('Processing:')} ${colors.cyan(movie.title)}`);
            const result = await processSingleMovie(context, movie);
            results.push(result);
            const successCount = results.filter(r => r.status === 'success').length;
            const failedCount = results.length - successCount;
            progressBar.update(movieNumber, { status: `✅ ${successCount} success, ❌ ${failedCount} failed` });
            if (movieNumber < missingMovies.length) {
                await cleanupBrowserTabs(context);
                console.log(`${colors.gray('⏳ Waiting 3 seconds before next movie...')}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        progressBar.stop();
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

async function cleanupBrowserTabs(context) {
    try {
        const pages = context.pages();
        for (let i = 1; i < pages.length; i++) {
            if (!pages[i].isClosed()) {
                await pages[i].close();
            }
        }
        if (global.gc) { global.gc(); }
        console.log(`${colors.gray('🧹 Cleaned up browser tabs and memory')}`);
    } catch (error) {
        console.log(`${colors.yellow('⚠️  Warning: Could not cleanup browser tabs:')}, ${error.message}`);
    }
}