const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();

  if (contexts.length === 0) {
    console.log('No browser contexts found');
    process.exit(1);
  }

  const context = contexts[0];
  const pages = context.pages();

  console.log(`Found ${pages.length} pages`);

  // Find the customer create page
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    console.log(`Page: ${url}`);
    if (url.includes('/customers/create')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log(
      'Customer create page not found. Please open http://localhost:3000/customers/create'
    );
    process.exit(1);
  }

  console.log('\n=== Listening to console logs ===\n');

  // Listen to console messages
  targetPage.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[${type.toUpperCase()}] ${text}`);
  });

  // Listen to page errors
  targetPage.on('pageerror', (error) => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Click the submit button
  console.log('\n=== Clicking submit button ===\n');

  try {
    // Wait for the button to be enabled
    await targetPage.waitForSelector('button:has-text("Создать клиента"):not([disabled])', {
      timeout: 5000,
    });
    console.log('Button is enabled, clicking...');

    await targetPage.click('button:has-text("Создать клиента")');
    console.log('Button clicked!');

    // Wait a bit to see the results
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n=== Done ===\n');
  process.exit(0);
})();
