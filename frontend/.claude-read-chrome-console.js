#!/usr/bin/env node

/**
 * Chrome Console Reader for WSL2
 *
 * Connects to Chrome running on Windows with remote debugging enabled.
 *
 * Requirements:
 * 1. Close all Chrome instances on Windows
 * 2. Launch Chrome with: chrome.exe --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
 * 3. Run this script from WSL2
 *
 * Usage: node .claude-read-chrome-console.js [url]
 * Example: node .claude-read-chrome-console.js http://localhost:3001/quotes/create
 */

const puppeteer = require('playwright');

// Windows host IP from WSL2
const WINDOWS_HOST = '10.255.255.254';
const CHROME_DEBUG_PORT = 9222;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const typeColors = {
    info: colors.cyan,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
  };
  const color = typeColors[type] || colors.white;
  console.log(`${colors.dim}${timestamp}${colors.reset} ${color}${message}${colors.reset}`);
}

async function connectToChrome(targetUrl) {
  try {
    log('🔗 Connecting to Chrome on Windows...', 'info');
    log(`   Windows Host: ${WINDOWS_HOST}:${CHROME_DEBUG_PORT}`, 'info');

    // First, check if Chrome debugging is accessible
    const versionUrl = `http://${WINDOWS_HOST}:${CHROME_DEBUG_PORT}/json/version`;

    log(`   Fetching: ${versionUrl}`, 'info');
    const versionResponse = await fetch(versionUrl);

    if (!versionResponse.ok) {
      throw new Error(
        `Chrome not accessible: ${versionResponse.status} ${versionResponse.statusText}`
      );
    }

    const versionData = await versionResponse.json();
    log(`✅ Chrome connected: ${versionData.Browser}`, 'success');
    log(`   WebSocket: ${versionData.webSocketDebuggerUrl}`, 'info');

    // Connect to Chrome using Playwright
    const browser = await puppeteer.chromium.connectOverCDP(
      `http://${WINDOWS_HOST}:${CHROME_DEBUG_PORT}`
    );
    log('✅ Playwright connected to Chrome', 'success');

    // Get existing contexts and pages
    const contexts = browser.contexts();
    log(`   Found ${contexts.length} browser context(s)`, 'info');

    let page;

    // Try to find existing page or create new one
    if (contexts.length > 0) {
      const pages = contexts[0].pages();
      log(`   Found ${pages.length} existing page(s)`, 'info');

      if (pages.length > 0) {
        // Use the first existing page
        page = pages[0];
        log('   Using existing Chrome tab', 'info');

        // Navigate to target URL if provided
        if (targetUrl) {
          log(`   Navigating to: ${targetUrl}`, 'info');
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        }
      } else {
        // Create new page in existing context
        page = await contexts[0].newPage();
        log('   Created new tab in existing context', 'info');
        if (targetUrl) {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        }
      }
    } else {
      throw new Error(
        'No browser contexts found. Make sure Chrome is running with debugging enabled.'
      );
    }

    log('✅ Page ready - monitoring console output...', 'success');
    log('   Press Ctrl+C to stop\n', 'info');

    // Listen to console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      // Color code by type
      const consoleColors = {
        error: colors.red,
        warning: colors.yellow,
        info: colors.cyan,
        log: colors.white,
        debug: colors.magenta,
      };

      const color = consoleColors[type] || colors.white;
      const typeLabel = `[${type.toUpperCase()}]`.padEnd(10);

      console.log(`${color}${typeLabel}${colors.reset} ${text}`);
      if (location.url && !location.url.startsWith('webpack://')) {
        console.log(`${colors.dim}  ${location.url}:${location.lineNumber}${colors.reset}`);
      }
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      console.log(`${colors.red}[PAGE ERROR]${colors.reset} ${error.message}`);
      if (error.stack) {
        console.log(`${colors.dim}${error.stack}${colors.reset}`);
      }
    });

    // Keep script running
    await new Promise(() => {});
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');

    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      log('', 'error');
      log('Chrome debugging not accessible. Please:', 'error');
      log('1. Close all Chrome instances on Windows', 'error');
      log('2. Launch Chrome with:', 'error');
      log('   chrome.exe --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0', 'error');
      log('3. Run this script again', 'error');
    }

    process.exit(1);
  }
}

// Get target URL from command line args
const targetUrl = process.argv[2] || 'http://localhost:3001/quotes/create';

log('🌐 Chrome Console Reader (WSL2 → Windows Chrome)', 'info');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

connectToChrome(targetUrl);
