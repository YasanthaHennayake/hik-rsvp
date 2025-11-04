const https = require('https');
const http = require('http');
const fs = require('fs');

// Configuration
const APP_URL = process.env.APP_URL || 'https://hik-rsvp-16382cf00537.herokuapp.com';
const NUM_REQUESTS = parseInt(process.env.NUM_REQUESTS) || 5;
const TEST_PHOTO_PATH = './test-photo.jpg'; // You can provide a test image

// Sample test photo (1x1 transparent PNG as base64 - minimal size)
const DEFAULT_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Generate test data for a single RSVP request
function generateTestData(index) {
  const timestamp = Date.now();
  return {
    firstName: `LoadTest${index}`,
    lastName: `User${timestamp}`,
    phone: `07${String(index).padStart(8, '0')}`,
    email: `loadtest${index}.${timestamp}@example.com`,
    organization: `Test Organization ${index}`,
    photo: DEFAULT_PHOTO
  };
}

// Make HTTP/HTTPS request as Promise
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const startTime = Date.now();
    const req = lib.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
            duration,
            dyno: res.headers['x-dyno'] || 'unknown' // Heroku adds this header
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData,
            duration,
            dyno: res.headers['x-dyno'] || 'unknown'
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Initialize a single RSVP
async function initializeRSVP(index) {
  const testData = generateTestData(index);

  console.log(`\n[Request ${index}] Initializing RSVP for ${testData.firstName} ${testData.lastName}...`);

  try {
    const response = await makeRequest(`${APP_URL}/api/init-rsvp`, 'POST', testData);

    console.log(`[Request ${index}] ✓ Status: ${response.statusCode}, Duration: ${response.duration}ms, Dyno: ${response.dyno}`);

    if (response.data.success) {
      console.log(`[Request ${index}] ✓ Session ID: ${response.data.sessionId}`);
      console.log(`[Request ${index}] ✓ Queue Position: ${response.data.queuePosition}`);
      return {
        index,
        success: true,
        sessionId: response.data.sessionId,
        duration: response.duration,
        dyno: response.dyno,
        statusCode: response.statusCode,
        queuePosition: response.data.queuePosition
      };
    } else {
      console.log(`[Request ${index}] ✗ Error: ${response.data.error}`);
      return {
        index,
        success: false,
        error: response.data.error,
        duration: response.duration,
        dyno: response.dyno,
        statusCode: response.statusCode
      };
    }
  } catch (error) {
    console.log(`[Request ${index}] ✗ Exception: ${error.message}`);
    return {
      index,
      success: false,
      error: error.message,
      duration: 0,
      dyno: 'error'
    };
  }
}

// Complete RSVP with dummy captcha (will likely fail, but tests the endpoint)
async function completeRSVP(sessionId, index) {
  console.log(`\n[Request ${index}] Attempting to complete RSVP...`);

  try {
    const response = await makeRequest(`${APP_URL}/api/complete-rsvp`, 'POST', {
      sessionId,
      captchaAnswer: '1234' // Dummy answer - will likely fail
    });

    console.log(`[Request ${index}] Complete Status: ${response.statusCode}, Duration: ${response.duration}ms, Dyno: ${response.dyno}`);

    return {
      index,
      success: response.data.success,
      duration: response.duration,
      dyno: response.dyno,
      error: response.data.error || null
    };
  } catch (error) {
    console.log(`[Request ${index}] Complete Exception: ${error.message}`);
    return {
      index,
      success: false,
      error: error.message
    };
  }
}

// Check health endpoint
async function checkHealth() {
  try {
    const response = await makeRequest(`${APP_URL}/api/health`, 'GET');
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
}

// Main load test
async function runLoadTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         RSVP System Load Test - Multi-Dyno Setup          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Target URL: ${APP_URL}`);
  console.log(`Concurrent Requests: ${NUM_REQUESTS}`);
  console.log(`Test Type: Simultaneous Init RSVP\n`);

  // Check health before test
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Checking server health before test...');
  console.log('─────────────────────────────────────────────────────────────');

  const healthBefore = await checkHealth();
  console.log('Server Status:', JSON.stringify(healthBefore, null, 2));

  // Run load test
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Starting load test...');
  console.log('─────────────────────────────────────────────────────────────');

  const startTime = Date.now();

  // Create promises for all requests
  const promises = [];
  for (let i = 1; i <= NUM_REQUESTS; i++) {
    promises.push(initializeRSVP(i));
  }

  // Execute all requests simultaneously
  const results = await Promise.all(promises);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // Analyze results
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Test Results Summary');
  console.log('─────────────────────────────────────────────────────────────');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map(r => r.duration));
  const minDuration = Math.min(...results.map(r => r.duration));

  // Count unique dynos
  const dynos = results.map(r => r.dyno).filter(d => d && d !== 'unknown' && d !== 'error');
  const uniqueDynos = [...new Set(dynos)];

  console.log(`\nTotal Requests:      ${NUM_REQUESTS}`);
  console.log(`Successful:          ${successful} (${(successful/NUM_REQUESTS*100).toFixed(1)}%)`);
  console.log(`Failed:              ${failed} (${(failed/NUM_REQUESTS*100).toFixed(1)}%)`);
  console.log(`\nTotal Time:          ${totalDuration}ms`);
  console.log(`Avg Response Time:   ${avgDuration.toFixed(0)}ms`);
  console.log(`Min Response Time:   ${minDuration}ms`);
  console.log(`Max Response Time:   ${maxDuration}ms`);
  console.log(`\nUnique Dynos Used:   ${uniqueDynos.length}`);
  if (uniqueDynos.length > 0) {
    console.log(`Dyno IDs:            ${uniqueDynos.join(', ')}`);
  }

  // Show distribution of requests per dyno
  if (dynos.length > 0) {
    console.log('\nRequests per Dyno:');
    const dynoCount = {};
    dynos.forEach(d => {
      dynoCount[d] = (dynoCount[d] || 0) + 1;
    });
    Object.entries(dynoCount).forEach(([dyno, count]) => {
      console.log(`  ${dyno}: ${count} requests`);
    });
  }

  // Show errors if any
  const errors = results.filter(r => !r.success && r.error);
  if (errors.length > 0) {
    console.log('\nErrors Encountered:');
    errors.forEach(e => {
      console.log(`  [Request ${e.index}] ${e.error}`);
    });
  }

  // Check health after test
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Checking server health after test...');
  console.log('─────────────────────────────────────────────────────────────');

  // Wait a moment for server to process
  await new Promise(resolve => setTimeout(resolve, 2000));

  const healthAfter = await checkHealth();
  console.log('Server Status:', JSON.stringify(healthAfter, null, 2));

  // Session cleanup test (optional)
  if (process.env.TEST_COMPLETE === 'true') {
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Testing session completion (with dummy captcha)...');
    console.log('─────────────────────────────────────────────────────────────');

    const sessionsToTest = results.filter(r => r.success && r.sessionId).slice(0, 2);

    if (sessionsToTest.length > 0) {
      const completeResults = await Promise.all(
        sessionsToTest.map(r => completeRSVP(r.sessionId, r.index))
      );

      console.log('\nCompletion Test Results:');
      completeResults.forEach(r => {
        console.log(`  [Request ${r.index}] ${r.success ? '✓ Success' : '✗ Failed: ' + r.error}`);
      });
    } else {
      console.log('No successful sessions to test completion.');
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('                    Load Test Complete                       ');
  console.log('═════════════════════════════════════════════════════════════\n');
}

// Run the test
runLoadTest().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
