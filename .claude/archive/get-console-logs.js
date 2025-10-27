#!/usr/bin/env node
/**
 * Get console logs from Chrome via DevTools Protocol
 * Connects to existing Chrome instance with debugging enabled
 */

const puppeteer = require('puppeteer-core');

async function getConsoleLogs() {
  let browser;
  try {
    console.log('🔍 Connecting to Chrome on port 9222...\n');

    // Connect to existing Chrome instance
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    // Get all pages
    const pages = await browser.pages();

    // Find the quotes/create page
    const targetPage = pages.find(page =>
      page.url().includes('localhost:3001/quotes')
    );

    if (!targetPage) {
      console.log('❌ Could not find the quotes/create page');
      console.log('📋 Available pages:');
      pages.forEach(p => console.log(`   - ${p.url()}`));
      return;
    }

    console.log(`✅ Found page: ${targetPage.url()}\n`);

    // Get console logs by evaluating JavaScript
    const consoleLogs = await targetPage.evaluate(() => {
      // This won't get historical logs, but we can check for current errors
      const errors = [];
      const warnings = [];
      const logs = [];

      // Check for React errors in the DOM
      const errorBoundaries = document.querySelectorAll('[data-react-error]');
      errorBoundaries.forEach(el => {
        errors.push({
          type: 'error',
          text: el.textContent
        });
      });

      // Check for any elements with error class
      const errorElements = document.querySelectorAll('.error, [class*="error"]');
      errorElements.forEach(el => {
        if (el.textContent.trim()) {
          errors.push({
            type: 'dom-error',
            text: el.textContent.trim().substring(0, 200)
          });
        }
      });

      return { errors, warnings, logs };
    });

    console.log('📊 Console Analysis:');
    console.log('═'.repeat(50));

    if (consoleLogs.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      consoleLogs.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. [${err.type}] ${err.text}`);
      });
    } else {
      console.log('\n✅ No DOM errors found');
    }

    // Get page title and loaded state
    const pageInfo = await targetPage.evaluate(() => ({
      title: document.title,
      readyState: document.readyState,
      url: window.location.href,
      hasReact: typeof window.React !== 'undefined',
      hasNext: typeof window.next !== 'undefined'
    }));

    console.log('\n📄 Page Info:');
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`   Ready State: ${pageInfo.readyState}`);
    console.log(`   React loaded: ${pageInfo.hasReact ? 'Yes' : 'No'}`);
    console.log(`   Next.js loaded: ${pageInfo.hasNext ? 'Yes' : 'No'}`);

    console.log('\n💡 To monitor live console messages, keep Chrome DevTools open (F12)');
    console.log('   or report any red errors you see to me.\n');

  } catch (error) {
    console.error('\n❌ Error connecting to Chrome:', error.message);
    console.error('   Make sure Chrome is running with --remote-debugging-port=9222\n');
  } finally {
    if (browser) {
      await browser.disconnect();
    }
  }
}

getConsoleLogs();
