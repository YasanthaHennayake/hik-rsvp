const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeRSVP, completeRSVP } = require('./scraper');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Redis setup for multi-dyno session storage
let redis = null;
let activeSessions = new Map(); // Fallback for development

if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    tls: {
      rejectUnauthorized: false // Required for Heroku Redis self-signed certs
    }
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err);
    console.log('Falling back to in-memory sessions');
    redis = null;
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected - multi-dyno sessions enabled');
  });
} else {
  console.log('⚠️  No REDIS_URL - using in-memory sessions (single dyno only)');
}

// Request queue to prevent resource exhaustion
const MAX_CONCURRENT_BROWSERS = 3; // Limit concurrent Puppeteer instances
let activeBrowsers = 0;
const requestQueue = [];

// Session storage wrapper
const sessionStorage = {
  async set(key, value, expirySeconds = 600) {
    if (redis) {
      await redis.setex(key, expirySeconds, JSON.stringify(value));
    } else {
      activeSessions.set(key, value);
    }
  },

  async get(key) {
    if (redis) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      return activeSessions.get(key) || null;
    }
  },

  async delete(key) {
    if (redis) {
      await redis.del(key);
    } else {
      activeSessions.delete(key);
    }
  }
};

// Queue management
async function processQueue() {
  if (requestQueue.length > 0 && activeBrowsers < MAX_CONCURRENT_BROWSERS) {
    const { task, resolve, reject } = requestQueue.shift();
    activeBrowsers++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      activeBrowsers--;
      processQueue(); // Process next in queue
    }
  }
}

function queueTask(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    processQueue();
  });
}

// Middleware

// Force HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    queue: {
      active: activeBrowsers,
      pending: requestQueue.length,
      maxConcurrent: MAX_CONCURRENT_BROWSERS
    },
    redis: redis ? 'connected' : 'not connected'
  });
});

// Debug endpoint - Get page screenshot
app.get('/api/debug-page', async (req, res) => {
  const puppeteer = require('puppeteer-core');
  let browser;

  try {
    console.log('Debug: Opening RSVP page...');

    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ]
    };

    // On Heroku, use Chrome from buildpack
    if (process.env.GOOGLE_CHROME_BIN) {
      launchOptions.executablePath = process.env.GOOGLE_CHROME_BIN;
    } else {
      // Try the chrome-for-testing path
      const fs = require('fs');
      const chromePath = '/app/.chrome-for-testing/chrome-linux64/chrome';
      if (fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
      }
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.goto('https://rsvp.hikvision.lk:8088/#/?nature=h5&app=Visitor&type=selfEntryVisitor&UserID=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
    const html = await page.content();

    await browser.close();

    res.json({
      success: true,
      screenshot: `data:image/png;base64,${screenshot}`,
      html: html.substring(0, 5000) // First 5000 chars
    });
  } catch (error) {
    console.error('Debug error:', error);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 1: Initialize RSVP - Fill form and get captcha
app.post('/api/init-rsvp', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, organization, photo } = req.body;

    console.log('Initializing RSVP for:', firstName, lastName);
    console.log('Queue status - Active:', activeBrowsers, 'Pending:', requestQueue.length);

    // Validate required fields
    if (!firstName || !lastName || !phone || !email || !organization || !photo) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if queue is too long
    if (requestQueue.length > 20) {
      return res.status(503).json({
        success: false,
        error: 'Server is too busy. Please try again in a few moments.',
        queueLength: requestQueue.length
      });
    }

    // Queue the browser task to prevent resource exhaustion
    const result = await queueTask(async () => {
      return await initializeRSVP({
        firstName,
        lastName,
        phone,
        email,
        organization,
        photo
      });
    });

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store session data (with browser/page references for cleanup)
    await sessionStorage.set(sessionId, {
      formData: { firstName, lastName, phone, email, organization },
      browserPid: result.browser._process?.pid, // For monitoring
      timestamp: Date.now()
    }, 600); // 10 minute expiry

    // Store browser reference separately for cleanup (not in Redis)
    activeSessions.set(sessionId, {
      page: result.page,
      browser: result.browser
    });

    res.json({
      success: true,
      sessionId,
      captchaImage: result.captchaImage,
      message: 'Please solve the captcha to complete registration',
      queuePosition: 0
    });
  } catch (error) {
    console.error('RSVP initialization failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Step 2: Complete RSVP with captcha answer
app.post('/api/complete-rsvp', async (req, res) => {
  try {
    const { sessionId, captchaAnswer } = req.body;

    console.log('Completing RSVP for session:', sessionId);

    if (!sessionId || !captchaAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and captcha answer are required'
      });
    }

    // Check if session exists in Redis/storage
    const sessionData = await sessionStorage.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({
        success: false,
        error: 'Session expired or invalid. Please start over.'
      });
    }

    // Get browser/page references from local memory
    const localSession = activeSessions.get(sessionId);
    if (!localSession || !localSession.page || !localSession.browser) {
      return res.status(400).json({
        success: false,
        error: 'Session data lost. This may happen if the server restarted. Please start over.'
      });
    }

    // Complete the RSVP with captcha
    const result = await completeRSVP(localSession.page, localSession.browser, captchaAnswer);

    // Clean up session from both storage and local memory
    await sessionStorage.delete(sessionId);
    activeSessions.delete(sessionId);

    res.json({
      success: true,
      message: 'RSVP completed successfully',
      data: {
        confirmationMessage: result.message,
        qrCode: result.qrCode,
        reservationCode: result.reservationCode,
        screenshot: result.screenshot
      }
    });
  } catch (error) {
    console.error('RSVP completion failed:', error);

    // Try to clean up session even on error
    if (req.body.sessionId) {
      const localSession = activeSessions.get(req.body.sessionId);
      if (localSession && localSession.browser) {
        try {
          await localSession.browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
      await sessionStorage.delete(req.body.sessionId);
      activeSessions.delete(req.body.sessionId);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old sessions (local browser instances)
async function cleanupOldSessions() {
  console.log('Running session cleanup...');
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;

  for (const [sessionId, localSession] of activeSessions.entries()) {
    // Check if session still exists in Redis/storage
    const sessionData = await sessionStorage.get(sessionId);

    if (!sessionData) {
      // Session expired in Redis, cleanup browser
      console.log('Cleaning up orphaned browser for session:', sessionId);
      if (localSession.browser) {
        try {
          await localSession.browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
      activeSessions.delete(sessionId);
    } else if (now - sessionData.timestamp > TEN_MINUTES) {
      // Session too old, cleanup
      console.log('Cleaning up old session:', sessionId);
      if (localSession.browser) {
        try {
          await localSession.browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
      await sessionStorage.delete(sessionId);
      activeSessions.delete(sessionId);
    }
  }

  console.log('Cleanup complete. Active sessions:', activeSessions.size);
}

// Run cleanup every 2 minutes
setInterval(cleanupOldSessions, 2 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up...');

  // Close all active browsers
  for (const [sessionId, localSession] of activeSessions.entries()) {
    if (localSession.browser) {
      try {
        await localSession.browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }
  }

  // Close Redis connection
  if (redis) {
    await redis.quit();
  }

  process.exit(0);
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});
