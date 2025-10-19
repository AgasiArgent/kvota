const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];

  console.log('Creating new page...\n');

  // Create a new page
  const page = await context.newPage();

  // Navigate to customers list
  console.log('Navigating to customers page...\n');
  await page.goto('http://localhost:3000/customers', { waitUntil: 'domcontentloaded', timeout: 10000 });

  // Wait for content
  await page.waitForTimeout(3000);

  // Get page content
  const content = await page.evaluate(() => {
    // Check if there's a table with customers
    const rows = document.querySelectorAll('table tbody tr');

    if (rows.length === 0) {
      return { hasCustomers: false, message: 'No customers found in table' };
    }

    const customers = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        customers.push({
          name: cells[0]?.textContent.trim(),
          email: cells[1]?.textContent.trim(),
          phone: cells[2]?.textContent.trim(),
          inn: cells[3]?.textContent.trim(),
        });
      }
    });

    return { hasCustomers: true, count: customers.length, customers };
  });

  console.log('=== Customers List ===');
  console.log(JSON.stringify(content, null, 2));

  // Look for our test customer
  if (content.customers) {
    const testCustomer = content.customers.find(c => c.name === 'name');
    if (testCustomer) {
      console.log('\n✅ Test customer found!');
      console.log(JSON.stringify(testCustomer, null, 2));
    } else {
      console.log('\n❌ Test customer NOT found');
      console.log('Available customers:', content.customers.map(c => c.name));
    }
  }

  await page.close();
  process.exit(0);
})();
