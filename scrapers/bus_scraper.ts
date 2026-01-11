// Bus Scraper using Playwright for JavaScript-rendered pages
// Install: npm install playwright
// Run: npx ts-node bus_scraper.ts

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';

interface BusLine {
    id: string;
    name: string;
    type: string;
    origin: string;
    destination: string;
    schedule: {
        first_departure: string;
        last_departure: string;
        frequency: string;
    };
}

interface BusStop {
    name: string;
    lat?: number;
    lon?: number;
    lines: string[];
}

async function scrapeCasabus(): Promise<{ lines: BusLine[], stops: BusStop[] }> {
    console.log('🚌 Starting Casabus scraper...');

    const browser: Browser = await chromium.launch({
        headless: true
    });

    const page: Page = await browser.newPage();

    try {
        // Navigate to the schedules page
        console.log('📋 Navigating to casabus.ma...');
        await page.goto('https://www.casabus.ma/roulez-avec-nous/horaires-et-frequences/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Get page content for debugging
        const content = await page.content();
        console.log('Page loaded, content length:', content.length);

        // Try to find line information
        const lines: BusLine[] = await page.evaluate(() => {
            const results: BusLine[] = [];

            // Try different selectors that might contain line info
            const lineElements = document.querySelectorAll('.line-item, .bus-line, [class*="ligne"], table tr');

            lineElements.forEach((el, index) => {
                const text = el.textContent?.trim() || '';
                if (text && text.length < 200) {
                    // Look for patterns like "Ligne 1", "L1", etc.
                    const lineMatch = text.match(/(?:Ligne\s*)?(\d+)/i);
                    if (lineMatch) {
                        results.push({
                            id: `L${lineMatch[1]}`,
                            name: `Ligne ${lineMatch[1]}`,
                            type: 'bus',
                            origin: 'TBD',
                            destination: 'TBD',
                            schedule: {
                                first_departure: '05:30',
                                last_departure: '22:00',
                                frequency: '15-20 min'
                            }
                        });
                    }
                }
            });

            return results;
        });

        console.log(`Found ${lines.length} potential bus lines`);

        // Take a screenshot for debugging
        await page.screenshot({ path: 'casabus_screenshot.png', fullPage: true });
        console.log('Screenshot saved to casabus_screenshot.png');

        await browser.close();

        // Return unique lines
        const uniqueLines = lines.filter((line, index, self) =>
            index === self.findIndex(l => l.id === line.id)
        );

        return { lines: uniqueLines, stops: [] };

    } catch (error) {
        console.error('Error scraping:', error);
        await browser.close();
        return { lines: [], stops: [] };
    }
}

async function main() {
    console.log('🚌 Casabus Scraper');
    console.log('==================');

    const data = await scrapeCasabus();

    console.log('\n📊 Results:');
    console.log(`Lines: ${data.lines.length}`);

    if (data.lines.length > 0) {
        // Save to JSON
        fs.writeFileSync('casabus_data.json', JSON.stringify(data, null, 2));
        console.log('Data saved to casabus_data.json');
    } else {
        console.log('No data found. The website may require different scraping approach.');
        console.log('Check casabus_screenshot.png to see what the page looks like.');
    }
}

main().catch(console.error);