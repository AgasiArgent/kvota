const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find customers page
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    if (url.includes('/customers')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log('Customer page not found, creating new one...');
    targetPage = await context.newPage();
  }

  console.log('Setting up request/response listeners...\n');

  // Capture requests and responses
  let capturedRequest = null;
  let capturedResponse = null;

  targetPage.on('request', (request) => {
    if (
      request.url().includes('/api/customers') &&
      request.method() === 'GET' &&
      !request.url().includes('create')
    ) {
      capturedRequest = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
      };
      console.log('📤 GET request captured');
    }
  });

  targetPage.on('response', async (response) => {
    if (
      response.url().includes('/api/customers') &&
      response.request().method() === 'GET' &&
      !response.url().includes('create')
    ) {
      try {
        const body = await response.text();
        capturedResponse = {
          status: response.status(),
          statusText: response.statusText(),
          body: body,
        };
        console.log('📥 Response received:', response.status());
      } catch (e) {
        console.log('Error capturing response:', e.message);
      }
    }
  });

  console.log('Refreshing customers page...\n');
  await targetPage.goto('http://localhost:3000/customers', {
    waitUntil: 'networkidle',
    timeout: 15000,
  });

  // Wait for requests
  await new Promise((resolve) => setTimeout(resolve, 3000));

  if (capturedRequest) {
    console.log('\n=== Request ===');
    console.log('URL:', capturedRequest.url);
    console.log('Has Auth:', capturedRequest.headers.authorization ? 'YES' : 'NO');
  }

  if (capturedResponse) {
    console.log('\n=== Response ===');
    console.log('Status:', capturedResponse.status, capturedResponse.statusText);
    console.log('Body:', capturedResponse.body);

    try {
      const json = JSON.parse(capturedResponse.body);
      console.log('\n=== Parsed ===');
      console.log(JSON.stringify(json, null, 2));

      if (json.customers) {
        console.log(`\n✅ Success! Found ${json.customers.length} customers`);
        json.customers.forEach((c) => {
          console.log(`  - ${c.name}`);
        });
      }
    } catch (e) {
      // Not JSON
    }
  }

  if (!capturedRequest && !capturedResponse) {
    console.log('❌ No API calls captured');
  }

  process.exit(0);
})();
