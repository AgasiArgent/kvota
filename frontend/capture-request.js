const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find the customer create page
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    if (url.includes('/customers/create')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log('Customer create page not found');
    process.exit(1);
  }

  console.log('Listening for API requests...\n');

  // Capture the request
  targetPage.on('request', (request) => {
    if (request.url().includes('/api/customers/') && request.method() === 'POST') {
      console.log('=== Captured Request ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', request.headers());
      console.log('Post Data:', request.postData());
    }
  });

  // Capture the response
  targetPage.on('response', async (response) => {
    if (response.url().includes('/api/customers/') && response.request().method() === 'POST') {
      console.log('\n=== Captured Response ===');
      console.log('Status:', response.status());
      console.log('Status Text:', response.statusText());
      console.log('Headers:', response.headers());

      try {
        const body = await response.text();
        console.log('Body:', body);

        try {
          const json = JSON.parse(body);
          console.log('\nParsed JSON:');
          console.log(JSON.stringify(json, null, 2));
        } catch (e) {
          // Not JSON
        }
      } catch (e) {
        console.log('Could not get response body:', e.message);
      }
    }
  });

  // Click the submit button
  console.log('Clicking submit button...\n');
  await targetPage.waitForSelector('button:has-text("Создать клиента"):not([disabled])', {
    timeout: 5000,
  });
  await targetPage.click('button:has-text("Создать клиента")');

  // Wait for the request/response
  await new Promise((resolve) => setTimeout(resolve, 3000));

  process.exit(0);
})();
