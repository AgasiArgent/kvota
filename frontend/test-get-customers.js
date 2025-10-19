const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find the customer create page to get auth
  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    if (url.includes('/customers')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log('No customer page found');
    process.exit(1);
  }

  // Get cookies
  const cookies = await context.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  console.log('Making API request to GET /api/customers/\n');

  try {
    const response = await fetch('http://localhost:8000/api/customers/', {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      }
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

      if (json.customers) {
        console.log(`\nFound ${json.customers.length} customers`);
        if (json.customers.length > 0) {
          console.log('First customer:', json.customers[0].name);
        }
      }
    } catch (e) {
      console.log('(Not valid JSON)');
    }

  } catch (error) {
    console.log('Request failed:', error.message);
  }

  process.exit(0);
})();
