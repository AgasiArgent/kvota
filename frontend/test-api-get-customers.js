const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find a page with the app
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    if (url.includes('localhost:3000')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log('No app page found');
    process.exit(1);
  }

  console.log('Capturing GET /api/customers/ request...\n');

  // Listen for the API request
  let apiRequest = null;
  let apiResponse = null;

  targetPage.on('request', request => {
    if (request.url().includes('/api/customers/') && request.method() === 'GET') {
      apiRequest = {
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      };
    }
  });

  targetPage.on('response', async response => {
    if (response.url().includes('/api/customers/') && response.request().method() === 'GET') {
      try {
        const body = await response.text();
        apiResponse = {
          status: response.status(),
          statusText: response.statusText(),
          body: body
        };
      } catch (e) {
        console.log('Error reading response:', e.message);
      }
    }
  });

  // Navigate to customers page to trigger the request
  await targetPage.goto('http://localhost:3000/customers', { waitUntil: 'networkidle', timeout: 10000 });

  // Wait for API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (apiRequest) {
    console.log('=== API Request ===');
    console.log('URL:', apiRequest.url);
    console.log('Method:', apiRequest.method);
    console.log('Authorization:', apiRequest.headers.authorization ? 'Present' : 'Missing');
  }

  if (apiResponse) {
    console.log('\n=== API Response ===');
    console.log('Status:', apiResponse.status);
    console.log('Status Text:', apiResponse.statusText);
    console.log('\nBody:', apiResponse.body);

    try {
      const json = JSON.parse(apiResponse.body);
      console.log('\n=== Parsed JSON ===');
      console.log(JSON.stringify(json, null, 2));

      if (json.customers) {
        console.log(`\n✅ Found ${json.customers.length} customers`);
        json.customers.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.name} (${c.email || 'no email'})`);
        });
      }
    } catch (e) {
      console.log('Not valid JSON');
    }
  }

  if (!apiRequest || !apiResponse) {
    console.log('❌ API request/response not captured');
  }

  process.exit(0);
})();
