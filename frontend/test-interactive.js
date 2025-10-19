const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Starting Interactive Testing Session\n');

  const browser = await chromium.launch({
    headless: false,  // Show browser
    slowMo: 500,      // Slow down actions
    devtools: true    // Open DevTools automatically
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log('❌ Console Error:', text);
    } else if (type === 'warning') {
      console.log('⚠️  Console Warning:', text);
    } else if (type === 'log') {
      console.log('📝 Console Log:', text);
    }
  });

  // Capture network errors
  page.on('requestfailed', request => {
    console.log('🌐 Network Failed:', request.url(), request.failure().errorText);
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log('💥 Page Error:', error.message);
  });

  try {
    // Test Onboarding Page
    console.log('📍 Navigating to: http://localhost:3000/onboarding\n');
    await page.goto('http://localhost:3000/onboarding', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit to see what happens
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/onboarding-playwright.png' });
    console.log('📸 Screenshot saved: screenshots/onboarding-playwright.png\n');

    // Check what's on the page
    const title = await page.title();
    console.log('📄 Page Title:', title);

    // Check if loading or content visible
    const loadingVisible = await page.$('.ant-skeleton');
    const contentVisible = await page.$('text=Добро пожаловать');

    if (loadingVisible) {
      console.log('⏳ Loading skeleton still visible');
    }
    if (contentVisible) {
      console.log('✅ Content loaded successfully');
    }

    console.log('\n🔍 Keeping browser open for inspection...');
    console.log('Press Ctrl+C to close when done.\n');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('\n💥 Test Error:', error.message);
    await page.screenshot({ path: 'screenshots/error-playwright.png' });
  }
})();
