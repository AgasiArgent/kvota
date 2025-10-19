const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Loading registration page...');
    await page.goto('http://localhost:3000/auth/register', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Get all input elements
    const inputs = await page.$$eval('input', elements =>
      elements.map(el => ({
        type: el.type,
        name: el.name,
        placeholder: el.placeholder,
        id: el.id
      }))
    );

    console.log('\nFound inputs:');
    inputs.forEach((inp, i) => {
      console.log(`  ${i+1}. type=${inp.type}, name=${inp.name}, placeholder=${inp.placeholder}, id=${inp.id}`);
    });

    // Get form structure
    const forms = await page.$$eval('form', elements =>
      elements.map(el => ({
        name: el.name,
        id: el.id
      }))
    );

    console.log('\nFound forms:', forms);

    // Take a screenshot
    await page.screenshot({ path: 'screenshots/register-page-check.png', fullPage: true });
    console.log('\nScreenshot saved: screenshots/register-page-check.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
