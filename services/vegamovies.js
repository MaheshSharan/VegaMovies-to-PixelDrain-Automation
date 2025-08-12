import { chromium } from "playwright";
import * as cheerio from "cheerio";
import path from "path";
import os from "os";

// Use your actual Chrome Default profile
const USER_DATA_DIR = path.join(os.homedir(), '.config', 'google-chrome');

export async function setupBrowser() {
    const headlessMode = process.env.HEADLESS_MODE === 'true';
    console.log(`  - Setting up browser with your real Chrome profile (headless: ${headlessMode})...`);
    
    // Use your Default Chrome profile specifically
    const profilePath = path.join(USER_DATA_DIR, 'Default');
    console.log(`  - Using Chrome profile: ${profilePath}`);
    
    const context = await chromium.launchPersistentContext(profilePath, {
        headless: headlessMode,
        executablePath: '/opt/google/chrome/chrome', // Use your actual Chrome installation
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-features=TranslateUI',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-infobars',
            '--disable-extensions-file-access-check',
            '--disable-extensions-http-throttling',
            '--disable-extensions-except', // This will load your real extensions
            '--load-extension', // This will load your real extensions
            '--user-data-dir=' + USER_DATA_DIR, // Explicitly set user data dir
            '--profile-directory=Default' // Explicitly set profile
        ],
        viewport: { width: 1920, height: 1080 },
        // Don't override user agent - use your real Chrome's user agent
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection']
    });
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    // Advanced stealth techniques
    await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        
        // Mock chrome runtime
        window.chrome = {
            runtime: {},
        };
    });
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    console.log('  - Browser setup complete.');
    return { browser: context, context, page };
}

export async function closeBrowser(browser) {
    if (browser) {
        await browser.close();
        console.log('  - Browser instance closed.');
    }
}

// Content sources with automatic failover
const CONTENT_SOURCES = [
    {
        name: 'VegaMovies',
        url: 'https://vegamovies.ax/',
        priority: 1,
        selectors: {
            container: '.blog-items-control',
            item: 'article.post-item',
            title: 'h3.post-title a',
            link: 'h3.post-title a',
            image: '.blog-pic img'
        }
    },
    {
        name: 'Bollyflix',
        url: 'https://bollyflix.fo/',
        priority: 2,
        selectors: {
            container: '.blog-items-control, .movies-list, .content-area',
            item: 'article.post-item, .movie-item, .content-item',
            title: 'h3.post-title a, .movie-title a, .title a',
            link: 'h3.post-title a, .movie-title a, .title a',
            image: '.blog-pic img, .movie-poster img, .thumbnail img'
        }
    }
];

async function scrapeFromSource(page, source) {
    console.log(`- Attempting to scrape from ${source.name} (${source.url})...`);
    
    try {
        await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Handle Cloudflare check
        const pageTitle = await page.title();
        if (pageTitle.includes('Checking your browser') || pageTitle.includes('Just a moment')) {
            console.log(`- Cloudflare check detected on ${source.name}. Waiting...`);
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('- Navigation complete after Cloudflare check.');
        }

        // Try multiple selectors for container
        const containerSelectors = source.selectors.container.split(', ');
        let containerFound = false;
        
        for (const selector of containerSelectors) {
            try {
                await page.waitForSelector(selector.trim(), { timeout: 15000 });
                containerFound = true;
                console.log(`- Found content container with selector: ${selector.trim()}`);
                break;
            } catch (e) {
                console.log(`- Container selector ${selector.trim()} not found, trying next...`);
            }
        }

        if (!containerFound) {
            throw new Error(`No content container found for ${source.name}`);
        }

        const content = await page.content();
        const $ = cheerio.load(content);
        const scrapedData = [];

        // Try multiple selectors for items
        const itemSelectors = source.selectors.item.split(', ');
        let itemsFound = false;

        for (const itemSelector of itemSelectors) {
            const items = $(itemSelector.trim());
            if (items.length > 0) {
                console.log(`- Found ${items.length} items with selector: ${itemSelector.trim()}`);
                
                items.each((_, element) => {
                    const titleSelectors = source.selectors.title.split(', ');
                    const linkSelectors = source.selectors.link.split(', ');
                    const imageSelectors = source.selectors.image.split(', ');
                    
                    let title, url, imageUrl;
                    
                    // Try multiple selectors for title/link
                    for (const titleSelector of titleSelectors) {
                        const linkElement = $(element).find(titleSelector.trim());
                        if (linkElement.length > 0) {
                            title = linkElement.attr('title') || linkElement.text().trim();
                            url = linkElement.attr('href');
                            break;
                        }
                    }
                    
                    // Try multiple selectors for image
                    for (const imageSelector of imageSelectors) {
                        const imageElement = $(element).find(imageSelector.trim());
                        if (imageElement.length > 0) {
                            imageUrl = imageElement.attr('src') || imageElement.attr('data-src');
                            break;
                        }
                    }
                    
                    // Make URLs absolute
                    if (url && !url.startsWith('http')) {
                        url = new URL(url, source.url).href;
                    }
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = new URL(imageUrl, source.url).href;
                    }
                    
                    if (title && url) {
                        scrapedData.push({ 
                            title, 
                            url, 
                            imageUrl,
                            source: source.name
                        });
                    }
                });
                
                itemsFound = true;
                break;
            }
        }

        if (!itemsFound) {
            throw new Error(`No items found for ${source.name}`);
        }

        console.log(`- ✅ Successfully scraped ${scrapedData.length} movies from ${source.name}`);
        return scrapedData;

    } catch (error) {
        console.log(`- ❌ Failed to scrape from ${source.name}: ${error.message}`);
        throw error;
    }
}

async function scrapeMainPage(page) {
    // Sort sources by priority
    const sortedSources = CONTENT_SOURCES.sort((a, b) => a.priority - b.priority);
    
    for (const source of sortedSources) {
        try {
            const data = await scrapeFromSource(page, source);
            if (data && data.length > 0) {
                return data;
            }
        } catch (error) {
            console.log(`- Source ${source.name} failed, trying next source...`);
            
            // If this is not the last source, continue to next
            if (source !== sortedSources[sortedSources.length - 1]) {
                console.log(`- Waiting 3 seconds before trying backup source...`);
                await page.waitForTimeout(3000);
                continue;
            } else {
                // This was the last source, throw error
                throw new Error(`All content sources failed. Last error: ${error.message}`);
            }
        }
    }
    
    return [];
}

export async function scrapeVegaMovies() {
    let browser;
    try {
        ({ browser } = await setupBrowser());
        const page = browser.pages()[0];
        const data = await scrapeMainPage(page);
        console.log(`- Successfully scraped ${data.length} items from VegaMovies.`);
        return data;
    } catch (error) {
        console.error('An error occurred during the scrapeVegaMovies process:', error);
        throw error;
    } finally {
        await closeBrowser(browser);
    }
}