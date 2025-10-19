const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find the customer create page to get the auth token
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

  // Get the auth token from localStorage
  const token = await targetPage.evaluate(() => {
    const data = localStorage.getItem('sb-wstwwmiihkzlgvlymlfd-auth-token');
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.access_token;
    }
    return null;
  });

  if (!token) {
    console.log('No auth token found');
    process.exit(1);
  }

  console.log('Auth token found, making API request...\n');

  // Make a test request to create a customer
  const testData = {
    organization_id: '77144c58-b396-4ec7-b51a-2a822ec6d889',
    name: 'Test Customer',
    company_type: 'organization',
    status: 'active',
  };

  try {
    const response = await fetch('http://localhost:8000/api/customers/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(testData),
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const responseText = await response.text();
    console.log('\nResponse Body:');
    console.log(responseText);

    try {
      const json = JSON.parse(responseText);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('(Not valid JSON)');
    }
  } catch (error) {
    console.log('Request failed:', error.message);
  }

  process.exit(0);
})();
