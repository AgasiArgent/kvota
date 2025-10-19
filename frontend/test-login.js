const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting login test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions for visibility
  });

  const page = await browser.newPage();

  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const emoji = {
      'log': '📝',
      'info': 'ℹ️',
      'warn': '⚠️',
      'error': '❌',
      'debug': '🐛'
    }[type] || '💬';
    console.log(`${emoji} [Console ${type}]: ${text}`);
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.log('❌ [Page Error]:', err.message);
    console.log('Stack:', err.stack);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    console.log(`❌ [Request Failed]: ${request.url()}`);
    console.log(`   Failure: ${request.failure().errorText}`);
  });

  // Capture all network requests
  const requests = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();

    if (url.includes('/api/')) {
      console.log(`🌐 [API Response]: ${status} ${response.request().method()} ${url}`);

      // Show response body for API calls
      try {
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.includes('application/json')) {
          const body = await response.json();
          console.log('   Response:', JSON.stringify(body, null, 2));
        }
      } catch (e) {
        // Ignore if can't parse
      }
    }
  });

  try {
    // Navigate to login page
    console.log('\n📍 Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Login page loaded');
    console.log('📸 Current URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'screenshots/01-login-page.png' });
    console.log('📸 Screenshot saved: 01-login-page.png');

    // Wait a bit to see the page
    await page.waitForTimeout(1000);

    // Fill in login form
    console.log('\n📝 Filling login form...');
    await page.fill('#login_email', 'andrey@novikov.fr');
    console.log('   Email filled');

    await page.fill('#login_password', 'slimshady');
    console.log('   Password filled');

    await page.screenshot({ path: 'screenshots/02-form-filled.png' });
    console.log('📸 Screenshot saved: 02-form-filled.png');

    // Submit the form
    console.log('\n🔐 Submitting login form...');
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await page.waitForTimeout(3000);

    console.log('\n📍 After login:');
    console.log('   Current URL:', page.url());

    await page.screenshot({ path: 'screenshots/03-after-login.png' });
    console.log('📸 Screenshot saved: 03-after-login.png');

    // Check if we're logged in by looking for common elements
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/organizations')) {
      console.log('\n✅ LOGIN SUCCESSFUL! Redirected to:', currentUrl);
    } else if (currentUrl.includes('/login')) {
      console.log('\n⚠️  Still on login page - login might have failed');

      // Look for error messages
      const errorMessages = await page.$$eval('[class*="error"], [role="alert"]',
        elements => elements.map(el => el.textContent)
      );
      if (errorMessages.length > 0) {
        console.log('   Error messages found:', errorMessages);
      }
    } else {
      console.log('\n🤔 Unexpected URL:', currentUrl);
    }

    // Check local storage for auth token
    const hasToken = await page.evaluate(() => {
      const token = localStorage.getItem('auth_token') ||
                    localStorage.getItem('supabase.auth.token') ||
                    localStorage.getItem('sb-wstwwmiihkzlgvlymlfd-auth-token');
      return !!token;
    });
    console.log('🔑 Auth token in localStorage:', hasToken ? 'YES' : 'NO');

    // Wait a bit before closing
    console.log('\n⏳ Waiting 5 seconds before closing...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.log('\n💥 TEST FAILED WITH ERROR:');
    console.log(error);
    await page.screenshot({ path: 'screenshots/error.png' });
    console.log('📸 Error screenshot saved: error.png');
  }

  console.log('\n🏁 Test complete. Closing browser...');
  await browser.close();
})();
