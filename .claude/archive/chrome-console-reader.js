#!/usr/bin/env node
/**
 * Quick script to read Chrome console messages via DevTools Protocol
 * Usage: node chrome-console-reader.js
 */

const http = require('http');

const CHROME_DEBUG_PORT = 9222;
const TARGET_URL = 'http://localhost:3001/quotes/create';

// Get the page ID for our target URL
function getPageId() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CHROME_DEBUG_PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const targetPage = pages.find(p => p.url.includes('localhost:3001/quotes'));
        if (targetPage) {
          resolve(targetPage.id);
        } else {
          reject(new Error('Target page not found'));
        }
      });
    }).on('error', reject);
  });
}

// Send CDP command via HTTP
function sendCommand(pageId, method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ method, params });
    const options = {
      hostname: 'localhost',
      port: CHROME_DEBUG_PORT,
      path: `/json/protocol`,
      method: 'GET'
    };

    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('🔍 Connecting to Chrome DevTools...');
    const pageId = await getPageId();
    console.log(`✅ Found page: ${pageId}\n`);

    console.log('📋 To get real-time console messages, use WebSocket connection.');
    console.log(`   WebSocket URL: ws://localhost:${CHROME_DEBUG_PORT}/devtools/page/${pageId}\n`);

    console.log('💡 Alternative: Install wscat and run:');
    console.log(`   npm install -g wscat`);
    console.log(`   wscat -c ws://localhost:${CHROME_DEBUG_PORT}/devtools/page/${pageId}`);
    console.log(`   {"id":1,"method":"Runtime.enable"}`);
    console.log(`   {"id":2,"method":"Console.enable"}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
