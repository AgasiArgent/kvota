const { chromium } = require('playwright');

(async () => {
  console.log('🔗 Connecting to your Chrome session...\n');

  try {
    // Connect to the Chrome instance running on port 9222
    const browser = await chromium.connectOverCDP('http://localhost:9222');

    const contexts = browser.contexts();
    console.log(`📱 Found ${contexts.length} browser contexts`);

    if (contexts.length === 0) {
      console.log('❌ No browser contexts found. Make sure Chrome is running with --remote-debugging-port=9222');
      process.exit(1);
    }

    const context = contexts[0];
    const pages = context.pages();
    console.log(`📄 Found ${pages.length} pages\n`);

    // Use the first page or wait for one
    let page = pages[0];
    if (!page) {
      console.log('⏳ Waiting for a page...');
      page = await context.waitForEvent('page');
    }

    console.log(`🌐 Current page: ${page.url()}\n`);

    // Listen to console logs from THIS point forward
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log('❌ Console Error:', text);
      } else if (type === 'warning') {
        console.log('⚠️  Warning:', text);
      } else if (type === 'log') {
        console.log('📝 Log:', text);
      }
    });

    // Listen to network failures
    page.on('requestfailed', request => {
      console.log('🌐 Network Failed:', request.url(), request.failure()?.errorText);
    });

    // Listen to page errors
    page.on('pageerror', error => {
      console.log('💥 Page Error:', error.message);
    });

    console.log('✅ Connected! I can now see console logs and errors.');
    console.log('👉 You can navigate normally in your Chrome window.');
    console.log('📊 I\'ll report any errors I see.\n');
    console.log('Press Ctrl+C here to stop monitoring.\n');

    // Keep running
    await new Promise(() => {});

  } catch (error) {
    console.error('💥 Connection Error:', error.message);
    console.log('\n💡 Make sure Chrome is running with: --remote-debugging-port=9222');
  }
})();
