const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting register and login test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();

  // Capture console and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ [Console error]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log('❌ [Page Error]:', err.message);
  });

  try {
    // Go to register page
    console.log('📍 Navigating to register page...');
    await page.goto('http://localhost:3000/auth/register', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✅ Register page loaded');
    await page.screenshot({ path: 'screenshots/register-page.png' });

    // Fill registration form
    console.log('\n📝 Filling registration form...');
    await page.fill('#register_full_name', 'Andrey Novikov');
    console.log('   Full name filled');

    await page.fill('#register_email', 'andrey@novikov.fr');
    console.log('   Email filled');

    await page.fill('#register_password', 'slimshady');
    console.log('   Password filled');

    await page.fill('#register_confirm', 'slimshady');
    console.log('   Password confirmation filled');

    // Select role
    await page.click('#register_role');
    await page.waitForTimeout(500);
    await page.click('text=Sales Manager'); // Click the role option
    console.log('   Role selected: Sales Manager');

    await page.screenshot({ path: 'screenshots/register-filled.png' });

    // Submit registration
    console.log('\n📤 Submitting registration...');
    await page.click('button:has-text("Зарегистрироваться")');

    await page.waitForTimeout(5000);

    console.log('📍 Current URL after registration:', page.url());
    await page.screenshot({ path: 'screenshots/after-register.png' });

    // Now try to login
    console.log('\n🔄 Now testing login...');
    await page.goto('http://localhost:3000/auth/login', {
      waitUntil: 'networkidle'
    });

    await page.fill('#login_email', 'andrey@novikov.fr');
    await page.fill('#login_password', 'slimshady');

    console.log('🔐 Submitting login...');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log('\n📍 After login:', finalUrl);
    await page.screenshot({ path: 'screenshots/after-login.png' });

    if (finalUrl.includes('/dashboard') || finalUrl.includes('/organizations')) {
      console.log('✅ SUCCESS! User registered and logged in!');
    } else if (finalUrl.includes('/login')) {
      console.log('⚠️  Still on login page');
    } else {
      console.log('🤔 Unexpected URL:', finalUrl);
    }

    await page.waitForTimeout(5000);

  } catch (error) {
    console.log('\n💥 TEST FAILED:');
    console.log(error.message);
    await page.screenshot({ path: 'screenshots/error.png' });
  }

  console.log('\n🏁 Test complete. Closing browser...');
  await browser.close();
})();
