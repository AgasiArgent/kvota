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
    if (url.includes('/customers')) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage) {
    console.log('No customer page found');
    process.exit(1);
  }

  // Get all localStorage keys
  const allStorage = await targetPage.evaluate(() => {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      storage[key] = localStorage.getItem(key);
    }
    return storage;
  });

  console.log('LocalStorage keys:');
  for (const [key, value] of Object.entries(allStorage)) {
    console.log(`  ${key}: ${value.substring(0, 100)}...`);
  }

  // Find the Supabase auth key
  const authKey = Object.keys(allStorage).find(k => k.includes('auth-token'));
  if (authKey) {
    const data = JSON.parse(allStorage[authKey]);
    console.log('\n=== Token Info ===');
    console.log('Access Token:', data.access_token.substring(0, 50) + '...');
    console.log('Token Type:', data.token_type);
    console.log('Expires:', new Date(data.expires_at * 1000).toISOString());
  }

  process.exit(0);
})();
