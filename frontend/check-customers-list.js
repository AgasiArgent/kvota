const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // Find any page
  let targetPage = pages[0];

  if (!targetPage) {
    console.log('No page found');
    process.exit(1);
  }

  console.log('Navigating to customers page...\n');

  // Navigate to customers list
  await targetPage.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });

  // Wait for the table or content to load
  await targetPage.waitForTimeout(2000);

  // Get page content
  const content = await targetPage.evaluate(() => {
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

  process.exit(0);
})();
