#!/usr/bin/env node
/**
 * Simple Console Reader using Playwright
 * Reads browser console logs from your app
 * Usage: node .claude/read-console.js [url]
 */

const { chromium } = require('playwright');

async function readConsole(url = 'http://localhost:3001') {
  console.log(`🔍 Opening ${url} and monitoring console...`);

  const browser = await chromium.launch({
    headless: false, // Set to true for headless mode
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    // Color code by type
    const colors = {
      error: '\x1b[31m', // Red
      warning: '\x1b[33m', // Yellow
      info: '\x1b[36m', // Cyan
      log: '\x1b[37m', // White
    };

    const color = colors[type] || '\x1b[37m';
    const reset = '\x1b[0m';

    console.log(`${color}[${type.toUpperCase()}]${reset} ${text}`);
    if (location.url) {
      console.log(`  ${location.url}:${location.lineNumber}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log(`\x1b[31m[PAGE ERROR]${'\x1b[0m'} ${error.message}`);
    console.log(error.stack);
  });

  // Navigate to the page
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('\n✅ Page loaded. Monitoring console... (Press Ctrl+C to stop)\n');

  // Keep the browser open
  // User can close it manually or press Ctrl+C
  await new Promise(() => {}); // Wait forever
}

const url = process.argv[2] || 'http://localhost:3001';
readConsole(url).catch(console.error);
