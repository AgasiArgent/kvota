const { chromium } = require('playwright');

(async () => {
  console.log('🌐 Opening registration page for manual testing...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null,
  });

  const page = await context.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log('❌ Browser Error:', text);
    } else if (type === 'warning' && !text.includes('antd')) {
      console.log('⚠️  Browser Warning:', text);
    } else if (type === 'log') {
      console.log('📝 Browser Log:', text);
    }
  });

  // Capture network errors
  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(`❌ HTTP ${response.status()}: ${response.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000/auth/register', { waitUntil: 'networkidle' });

    console.log('✅ Registration page loaded');
    console.log('📍 URL:', page.url());
    console.log('\n👉 Browser is open for you to test manually');
    console.log('   Try registering with:');
    console.log('   - Existing email: andrey@novikov.fr (should show error)');
    console.log('   - New email: test-new-' + Date.now() + '@example.com (should succeed)');
    console.log('\n⏸️  Press Ctrl+C to close the browser when done\n');

    // Keep browser open
    await new Promise(() => {});
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
  }
})();
