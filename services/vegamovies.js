import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from 'url';

const stealth = stealthPlugin();
chromium.use(stealth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_DATA_DIR = path.join(__dirname, 'browser_profile');

export async function setupBrowser() {
    console.log('  - Setting up stealth browser with persistent profile...');
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false, // Set to true for production, false for debugging
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    console.log('  - Browser setup complete.');
    return { browser: context, context, page };
}

export async function closeBrowser(browser) {
    if (browser) {
        await browser.close();
        console.log('  - Browser instance closed.');
    }
}

async function scrapeMainPage(page) {
    const scrapedData = [];
    const targetUrl = 'https://vegamovies.ax/';
    console.log(`- Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const pageTitle = await page.title();
    if (pageTitle.includes('Checking your browser')) {
        console.log('- Cloudflare check detected. Waiting for navigation...');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('- Navigation complete after Cloudflare check.');
    }

    await page.waitForSelector('.blog-items-control', { timeout: 30000 });
    const content = await page.innerHTML('.blog-items-control');
    const $ = cheerio.load(content);

    $('article.post-item').each((_, element) => {
        const linkElement = $(element).find('h3.post-title a');
        const imageElement = $(element).find('.blog-pic img');
        const title = linkElement.attr('title');
        let url = linkElement.attr('href');
        let imageUrl = imageElement.attr('src');
        if (url && !url.startsWith('http')) url = new URL(url, targetUrl).href;
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, targetUrl).href;
        if (title && url) scrapedData.push({ title, url, imageUrl });
    });
    return scrapedData;
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