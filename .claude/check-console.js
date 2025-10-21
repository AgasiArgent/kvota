#!/usr/bin/env node
/**
 * Check Chrome console for errors using Playwright
 * Usage: node .claude/check-console.js
 */

const { chromium } = require('./frontend/node_modules/playwright');

async function checkConsole() {
  let browser;
  try {
    console.log('🔍 Connecting to Chrome via CDP...\n');

    // Connect to existing Chrome instance
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const pages = await contexts[0].pages();

    // Find the quotes/create page
    const page = pages.find(p => p.url().includes('localhost:3001/quotes'));

    if (!page) {
      console.log('❌ Could not find the quotes/create page');
      console.log('\n📋 Available pages:');
      for (const p of pages) {
        console.log(`   - ${p.url()}`);
      }
      return;
    }

    console.log(`✅ Found page: ${page.url()}\n`);

    // Get page info
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      readyState: document.readyState,
      url: window.location.href
    }));

    console.log('📄 Page Info:');
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   Ready State: ${pageInfo.readyState}`);
    console.log(`   URL: ${pageInfo.url}\n`);

    // Check for DOM errors and React errors
    const domCheck = await page.evaluate(() => {
      const issues = {
        errors: [],
        warnings: [],
        reactErrors: []
      };

      // Check for React error boundaries
      const errorBoundaries = document.querySelectorAll('[data-react-error], [data-error]');
      errorBoundaries.forEach(el => {
        issues.reactErrors.push(el.textContent.trim().substring(0, 300));
      });

      // Check for visible error messages
      const errorElements = document.querySelectorAll('[class*="error"]:not([class*="errorBoundary"])');
      errorElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 5 && text.length < 500) {
          issues.warnings.push(text);
        }
      });

      // Check if ag-Grid loaded
      const agGridPresent = document.querySelector('[class*="ag-root"]') !== null;

      // Check if Ant Design components loaded
      const antdPresent = document.querySelector('[class*="ant-"]') !== null;

      return {
        ...issues,
        agGridPresent,
        antdPresent,
        bodyClasses: document.body.className,
        hasContent: document.body.textContent.trim().length > 100
      };
    });

    console.log('🔍 DOM Analysis:');
    console.log('═'.repeat(50));

    if (domCheck.reactErrors.length > 0) {
      console.log('\n❌ REACT ERRORS:');
      domCheck.reactErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    if (domCheck.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS/MESSAGES:');
      domCheck.warnings.slice(0, 5).forEach((warn, i) => {
        console.log(`   ${i + 1}. ${warn.substring(0, 100)}...`);
      });
    }

    if (domCheck.reactErrors.length === 0 && domCheck.warnings.length === 0) {
      console.log('\n✅ No obvious DOM errors found');
    }

    console.log('\n📦 Libraries Loaded:');
    console.log(`   ag-Grid: ${domCheck.agGridPresent ? '✅ Yes' : '❌ No'}`);
    console.log(`   Ant Design: ${domCheck.antdPresent ? '✅ Yes' : '❌ No'}`);
    console.log(`   Body has content: ${domCheck.hasContent ? '✅ Yes' : '❌ No'}`);

    // Take a screenshot for visual inspection
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({
      path: '.claude/current-page-screenshot.png',
      fullPage: false
    });
    console.log('   Saved to: .claude/current-page-screenshot.png');

    console.log('\n💡 Next: Open Chrome DevTools (F12) to see live console messages,');
    console.log('   or report any red errors to me.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('Target page')) {
      console.error('   Chrome might not be running with --remote-debugging-port=9222');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

checkConsole().catch(console.error);
