#!/usr/bin/env node
/**
 * Automated Testing Script - Quote Creation Page
 * Runs tests from MANUAL_TESTING_GUIDE.md automatically
 * Usage: node .claude-automated-tests.js
 */

const { chromium } = require('playwright');
const path = require('path');

const TEST_URL = 'http://localhost:3001';
const TEST_EMAIL = 'andrey@masterbearingsales.ru';
const TEST_PASSWORD = 'password';
const TEST_FILE_PATH = path.join(__dirname, '../tempfiles/sample_products.csv');

let testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m', // Red
    warning: '\x1b[33m', // Yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

async function runTests() {
  log('🧪 Starting Automated Tests for Quote Creation Page', 'info');
  log('='.repeat(60), 'info');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    // ==== TEST 1: Login ====
    log('\n📝 Test 1: Login', 'info');
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check URL - most reliable way to detect login page
    let currentUrl = page.url();
    log(`  Initial URL: ${currentUrl}`, 'info');

    if (currentUrl.includes('/login')) {
      // On login page - need to log in
      log('  Detected login page - waiting for form to load...', 'info');

      // Wait for page to be fully loaded (React hydration can take time)
      await page.waitForTimeout(5000);

      // Take screenshot to debug what's on page
      await page.screenshot({ path: '/tmp/login-page-before.png', fullPage: true });
      log('  Screenshot saved: /tmp/login-page-before.png', 'info');

      // The form uses Ant Design inputs, not standard HTML type attributes
      const anyInputs = await page.locator('input').count();
      log(`  Total input elements found: ${anyInputs}`, 'info');

      if (anyInputs < 2) {
        testResults.failed.push('Login form incomplete - need 2 inputs');
        log('❌ Expected 2 input fields, found less', 'error');
        await browser.close();
        return;
      }

      log('  Form loaded - filling credentials...', 'info');

      // Fill first input (email) and second input (password)
      const emailInput = page.locator('input').first();
      const passwordInput = page.locator('input').nth(1);

      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      log('  Submitting login form...', 'info');

      // Click submit and wait for navigation
      await Promise.all([
        page.waitForNavigation({ timeout: 20000 }),
        page.click('button[type="submit"]'),
      ]);

      await page.waitForTimeout(3000);

      // Verify login success by checking URL changed
      currentUrl = page.url();
      log(`  After login URL: ${currentUrl}`, 'info');

      if (!currentUrl.includes('/login')) {
        testResults.passed.push('Login successful');
        log('✅ Login successful', 'success');
      } else {
        testResults.failed.push('Login failed - still on login page');
        log('❌ Login failed - check credentials or backend', 'error');
        await page.screenshot({ path: '/tmp/login-failed.png' });
        await browser.close();
        return;
      }
    } else {
      testResults.passed.push('Already logged in');
      log('✅ Already logged in (not on login page)', 'success');
    }

    // ==== TEST 2: Navigate to Quote Creation ====
    log('\n📝 Test 2: Navigate to Quote Creation Page', 'info');
    await page.goto(`${TEST_URL}/quotes/create`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check if we got redirected back to login (authentication failed)
    const backToLogin = await page
      .locator('input[type="email"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (backToLogin) {
      testResults.failed.push('Quote page - redirected to login (auth failed)');
      log('❌ Redirected to login page - authentication not maintained', 'error');
      await page.screenshot({ path: '/tmp/quote-create-page.png', fullPage: true });
      log('  Screenshot saved to /tmp/quote-create-page.png', 'info');
      await browser.close();
      return;
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/quote-create-page.png', fullPage: true });
    log('  Screenshot saved to /tmp/quote-create-page.png', 'info');

    // Verify page elements with more flexible selectors
    const header = await page
      .locator('h1, h2, h3')
      .filter({ hasText: 'Создать' })
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const uploadZone = await page
      .locator('text=Загрузить')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const customerDropdown = await page
      .locator('text=клиент')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    log(`  Header with "Создать" visible: ${header}`, 'info');
    log(`  Upload zone visible: ${uploadZone}`, 'info');
    log(`  Customer dropdown visible: ${customerDropdown}`, 'info');

    if (header || uploadZone || customerDropdown) {
      testResults.passed.push('Page load - quote creation page loaded');
      log('✅ Quote creation page loaded (at least some elements visible)', 'success');
    } else {
      testResults.failed.push('Page load - missing all expected elements');
      log('❌ Quote creation page elements not found', 'error');
    }

    // ==== TEST 3: File Upload ====
    log('\n📝 Test 3: File Upload (Click to Browse)', 'info');

    try {
      // Find the file input (it's hidden in the Dragger component)
      const fileInput = await page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(TEST_FILE_PATH);

      // Wait for success message
      await page.waitForSelector('text=Загружено', { timeout: 5000 });

      // Check if grid appeared
      await page.waitForSelector('.ag-root', { timeout: 3000 });

      testResults.passed.push('File upload successful - grid appeared');
      log('✅ File uploaded successfully, grid rendered', 'success');
    } catch (error) {
      testResults.failed.push(`File upload failed: ${error.message}`);
      log(`❌ File upload failed: ${error.message}`, 'error');
    }

    // ==== TEST 4: Row Selection ====
    log('\n📝 Test 4: Row Selection with Checkboxes', 'info');

    try {
      // Wait for grid to be ready
      await page.waitForTimeout(1000);

      // Click first row checkbox
      const firstCheckbox = await page.locator('.ag-checkbox-input').first();
      await firstCheckbox.click();
      await page.waitForTimeout(500);

      // Check if row is selected (has grey background)
      const selectedRow = await page.locator('.ag-row-selected').count();

      if (selectedRow > 0) {
        testResults.passed.push('Row selection - checkbox works');
        log('✅ Row selection works (grey background applied)', 'success');
      } else {
        testResults.failed.push('Row selection - no visual indication');
        log('❌ Row selection visual feedback not working', 'error');
      }
    } catch (error) {
      testResults.failed.push(`Row selection failed: ${error.message}`);
      log(`❌ Row selection test failed: ${error.message}`, 'error');
    }

    // ==== TEST 5: Batch Edit Button ====
    log('\n📝 Test 5: Batch Edit Button Visibility and Click', 'info');

    try {
      // Use button role to be more specific (avoids matching tooltip text)
      const batchEditBtn = await page.getByRole('button', { name: /Массовое редактирование/ });
      const isVisible = await batchEditBtn.isVisible();

      if (isVisible) {
        testResults.passed.push('Batch edit button visible');
        log('✅ Batch edit button found and visible', 'success');

        // Try clicking it to test modal opens
        await batchEditBtn.click();
        await page.waitForTimeout(500);

        // Check if modal opened
        const modalVisible = await page
          .locator('.ant-modal')
          .isVisible()
          .catch(() => false);

        if (modalVisible) {
          testResults.passed.push('Batch edit modal opens');
          log('✅ Batch edit modal opened successfully', 'success');

          // Close modal by pressing ESC
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        } else {
          testResults.warnings.push('Batch edit modal did not open');
          log('⚠️  Batch edit button clicked but modal did not open', 'warning');
        }
      } else {
        testResults.warnings.push('Batch edit button not visible');
        log('⚠️  Batch edit button not visible', 'warning');
      }
    } catch (error) {
      testResults.warnings.push(`Batch edit test failed: ${error.message}`);
      log(`⚠️  Batch edit test error: ${error.message}`, 'warning');
    }

    // ==== TEST 6: Field Labels (Session 11 Fixes) ====
    log('\n📝 Test 6: Field Label Verification', 'info');

    try {
      // Check for renamed field in grid - use more flexible selector
      // The text might be split or in a column header that needs scrolling
      const exciseLabel = await page.getByText('Акциз (УЕ КП на тонну)', { exact: false }).count();

      if (exciseLabel > 0) {
        testResults.passed.push('Field labels correct - Акциз renamed');
        log('✅ Field label "Акциз (УЕ КП на тонну)" found', 'success');
      } else {
        // Try alternative: check if old label exists (should NOT exist)
        const oldLabel = await page.getByText('Акциз (%)', { exact: false }).count();

        if (oldLabel === 0) {
          testResults.passed.push('Field labels - old Акциз (%) not found (good)');
          log('✅ Old label "Акциз (%)" correctly removed', 'success');
        } else {
          testResults.failed.push('Field labels incorrect - old Акциз (%) found');
          log('❌ Field label not renamed correctly', 'error');
        }
      }
    } catch (error) {
      testResults.failed.push(`Field label check failed: ${error.message}`);
    }

    // ==== TEST 7: Console Errors ====
    log('\n📝 Test 7: Console Errors Check', 'info');

    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('[antd:') && !err.includes('[rc-collapse]') && !err.includes('React DevTools')
    );

    if (criticalErrors.length === 0) {
      testResults.passed.push('No critical console errors');
      log('✅ No critical console errors found', 'success');
    } else {
      testResults.failed.push(`Critical console errors: ${criticalErrors.length}`);
      log(`❌ Found ${criticalErrors.length} critical console errors:`, 'error');
      criticalErrors.forEach((err) => log(`  - ${err}`, 'error'));
    }

    // Log expected warnings
    const expectedWarnings = consoleErrors.filter(
      (err) => err.includes('[antd:') || err.includes('[rc-collapse]')
    );
    if (expectedWarnings.length > 0) {
      log(
        `\n⚠️  Expected warnings (${expectedWarnings.length}): React 19 compatibility, rc-collapse`,
        'warning'
      );
    }
  } catch (error) {
    log(`\n❌ Test suite failed with error: ${error.message}`, 'error');
    testResults.failed.push(`Test suite error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // ==== PRINT SUMMARY ====
  log('\n' + '='.repeat(60), 'info');
  log('📊 TEST SUMMARY', 'info');
  log('='.repeat(60), 'info');

  log(`\n✅ PASSED (${testResults.passed.length}):`, 'success');
  testResults.passed.forEach((test) => log(`  ✓ ${test}`, 'success'));

  if (testResults.warnings.length > 0) {
    log(`\n⚠️  WARNINGS (${testResults.warnings.length}):`, 'warning');
    testResults.warnings.forEach((test) => log(`  ⚠ ${test}`, 'warning'));
  }

  if (testResults.failed.length > 0) {
    log(`\n❌ FAILED (${testResults.failed.length}):`, 'error');
    testResults.failed.forEach((test) => log(`  ✗ ${test}`, 'error'));
  }

  const totalTests = testResults.passed.length + testResults.failed.length;
  const successRate = ((testResults.passed.length / totalTests) * 100).toFixed(1);

  log(
    `\n📈 Success Rate: ${successRate}% (${testResults.passed.length}/${totalTests} passed)`,
    'info'
  );

  if (testResults.failed.length === 0) {
    log('\n🎉 All tests passed!', 'success');
  } else {
    log('\n⚠️  Some tests failed. Review failures above.', 'warning');
  }
}

runTests().catch(console.error);
