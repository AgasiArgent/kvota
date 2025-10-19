const { chromium } = require('playwright');

(async () => {
  console.log('🌐 Opening Chromium browser...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();

  await page.goto('http://localhost:3000/auth/register');

  console.log('✅ Browser opened at registration page');
  console.log('📍 URL: http://localhost:3000/auth/register');
  console.log('\n💡 Browser will stay open - you can test manually');
  console.log('⚠️  Press Ctrl+C in terminal when done to close browser\n');

  // Keep the script running
  await new Promise(() => {});
})();
