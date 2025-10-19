const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting login test (headless mode)...\n');

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Capture all console messages
    page.on('console', (msg) => {
      console.log(`[Console ${msg.type()}]: ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', (err) => {
      console.log('❌ [Page Error]:', err.message);
    });

    // Capture failed requests
    page.on('requestfailed', (request) => {
      console.log(`❌ [Request Failed]: ${request.url()}`);
    });

    // Capture API responses
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      if (url.includes('/api/')) {
        console.log(`🌐 [API]: ${status} ${response.request().method()} ${url}`);
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const body = await response.json();
            console.log('   Response:', JSON.stringify(body, null, 2));
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    console.log('📍 Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('✅ Login page loaded');
    await page.screenshot({ path: 'screenshots/01-login-page.png' });

    console.log('📝 Filling login form...');
    await page.fill('#login_email', 'andrey@novikov.fr');
    await page.fill('#login_password', 'slimshady');
    await page.screenshot({ path: 'screenshots/02-form-filled.png' });

    console.log('🔐 Submitting login form...');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('\n📍 After login:', currentUrl);
    await page.screenshot({ path: 'screenshots/03-after-login.png' });

    if (currentUrl.includes('/dashboard') || currentUrl.includes('/organizations')) {
      console.log('✅ LOGIN SUCCESSFUL!');
    } else if (currentUrl.includes('/login')) {
      console.log('⚠️  Still on login page');
      const errorMessages = await page.$$eval('[class*="error"], [role="alert"]', (elements) =>
        elements.map((el) => el.textContent)
      );
      if (errorMessages.length > 0) {
        console.log('   Errors:', errorMessages);
      }
    }

    const hasToken = await page.evaluate(() => {
      const token =
        localStorage.getItem('auth_token') ||
        localStorage.getItem('supabase.auth.token') ||
        localStorage.getItem('sb-wstwwmiihkzlgvlymlfd-auth-token');
      return !!token;
    });
    console.log('🔑 Auth token:', hasToken ? 'YES' : 'NO');

    await browser.close();
    console.log('\n✅ Test complete!');
  } catch (error) {
    console.log('\n💥 TEST FAILED:');
    console.log(error.message);
    process.exit(1);
  }
})();
