// Simple Chrome profile test
import { chromium } from "playwright";
import path from "path";
import os from "os";

async function testChromeProfile() {
    console.log("🧪 Testing Chrome Profile Integration...");
    
    const USER_DATA_DIR = path.join(os.homedir(), '.config', 'google-chrome');
    const profilePath = path.join(USER_DATA_DIR, 'Default');
    
    console.log(`Profile path: ${profilePath}`);
    
    try {
        // Test with minimal configuration first
        const context = await chromium.launchPersistentContext(profilePath, {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        
        console.log("✅ Chrome launched successfully!");
        
        const page = context.pages()[0] || await context.newPage();
        
        // Test basic functionality
        await page.goto('https://www.google.com', { timeout: 30000 });
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        // Check cookies
        const cookies = await context.cookies();
        console.log(`Loaded ${cookies.length} cookies from your profile`);
        
        await context.close();
        console.log("✅ Test completed successfully!");
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

testChromeProfile();