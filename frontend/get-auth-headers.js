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

  // Inject code to get token from Next.js page
  const authHeaders = await targetPage.evaluate(async () => {
    // Try to get headers that the page would send
    try {
      // Simulate what customer-service.ts does
      const { createClient } = await import('/src/lib/supabase/client.ts');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        return {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        };
      }
      return null;
    } catch (e) {
      return { error: e.message };
    }
  });

  if (!authHeaders) {
    console.log('No auth headers found');
    process.exit(1);
  }

  if (authHeaders.error) {
    console.log('Error getting auth headers:', authHeaders.error);
    process.exit(1);
  }

  console.log('Got auth headers!');
  const token = authHeaders.Authorization.replace('Bearer ', '');
  console.log('Token:', token.substring(0, 50) + '...');

  // Now make the API call
  const testData = {
    organization_id: '77144c58-b396-4ec7-b51a-2a822ec6d889',
    name: 'Test Customer',
    company_type: 'organization',
    status: 'active'
  };

  console.log('\n=== Making API Request ===');
  console.log('URL: http://localhost:8000/api/customers/');
  console.log('Data:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch('http://localhost:8000/api/customers/', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(testData)
    });

    console.log('\n=== Response ===');
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
