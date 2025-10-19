const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing Registration Flow with Fixes\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down actions to see what's happening
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') console.log('❌ Browser Error:', msg.text());
    else if (type === 'warning') console.log('⚠️  Browser Warning:', msg.text());
  });

  try {
    // Test 1: Try registering with EXISTING email (should show error)
    console.log('\n📝 Test 1: Register with existing email (andrey@novikov.fr)');
    await page.goto('http://localhost:3000/auth/register', { waitUntil: 'networkidle' });

    // Wait for the form to be fully loaded
    console.log('   Waiting for form to load...');
    await page.waitForSelector('#register_full_name', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.fill('#register_full_name', 'Test User');
    await page.fill('#register_email', 'andrey@novikov.fr');
    await page.fill('#register_password', 'test123456');
    await page.fill('#register_confirmPassword', 'test123456');

    console.log('   Submitting form...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Check for error message
    const errorAlert = await page.$('.ant-alert-error');
    if (errorAlert) {
      const errorText = await errorAlert.textContent();
      console.log('   ✅ Error shown correctly:', errorText.substring(0, 100));
    } else {
      console.log('   ❌ ERROR: No error message shown!');
    }

    // Should still be on registration page
    const url1 = page.url();
    if (url1.includes('/register')) {
      console.log('   ✅ Still on registration page (correct behavior)');
    } else {
      console.log('   ❌ ERROR: Redirected away from registration page!');
    }

    // Test 2: Register with NEW email (should show success)
    console.log('\n📝 Test 2: Register with new email (test-' + Date.now() + '@example.com)');
    const newEmail = 'test-' + Date.now() + '@example.com';

    await page.fill('#register_full_name', 'New Test User');
    await page.fill('#register_email', newEmail);
    await page.fill('#register_password', 'test123456');
    await page.fill('#register_confirmPassword', 'test123456');

    console.log('   Submitting form...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Check for success message
    const successTitle = await page.$('h2:has-text("Регистрация успешна")');
    if (successTitle) {
      console.log('   ✅ Success title shown');
    } else {
      console.log('   ❌ ERROR: Success title not found!');
    }

    // Check if email is displayed in success message
    const pageContent = await page.content();
    if (pageContent.includes(newEmail)) {
      console.log('   ✅ Email displayed in success message:', newEmail);
    } else {
      console.log('   ❌ ERROR: Email not displayed in success message!');
      console.log('   Page content check failed');
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/registration-success.png' });
    console.log('   📸 Screenshot saved: screenshots/registration-success.png');

    console.log('\n✅ All registration tests completed!');
    console.log('\n⏸️  Browser will stay open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    await page.screenshot({ path: 'screenshots/test-error.png' });
  } finally {
    await browser.close();
    console.log('\n🏁 Tests finished');
  }
})();
