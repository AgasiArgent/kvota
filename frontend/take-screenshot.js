const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const contexts = browser.contexts();

    if (contexts.length > 0) {
      const pages = contexts[0].pages();
      if (pages.length > 0) {
        const page = pages[0];
        await page.screenshot({ path: 'screenshots/current-state.png' });
        console.log('✅ Screenshot saved: screenshots/current-state.png');
        console.log('📍 Current URL:', page.url());
      } else {
        console.log('❌ No pages found');
      }
    } else {
      console.log('❌ No browser contexts found');
    }

    await browser.close();
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
})();
