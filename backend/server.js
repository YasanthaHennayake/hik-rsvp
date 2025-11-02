const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeRSVP, completeRSVP } = require('./scraper');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Store for active sessions (in production, use Redis or a database)
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Debug endpoint - Get page screenshot
app.get('/api/debug-page', async (req, res) => {
  const puppeteer = require('puppeteer');
  let browser;

  try {
    console.log('Debug: Opening RSVP page...');

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

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

    // Validate required fields
    if (!firstName || !lastName || !phone || !email || !organization || !photo) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Initialize RSVP and get captcha
    const result = await initializeRSVP({
      firstName,
      lastName,
      phone,
      email,
      organization,
      photo
    });

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store session data
    activeSessions.set(sessionId, {
      formData: { firstName, lastName, phone, email, organization },
      page: result.page,
      browser: result.browser,
      timestamp: Date.now()
    });

    // Clean up old sessions (older than 10 minutes)
    cleanupOldSessions();

    res.json({
      success: true,
      sessionId,
      captchaImage: result.captchaImage,
      message: 'Please solve the captcha to complete registration'
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

    // Get session data
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Session expired or invalid. Please start over.'
      });
    }

    // Complete the RSVP with captcha
    const result = await completeRSVP(session.page, session.browser, captchaAnswer);

    // Clean up session
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
      const session = activeSessions.get(req.body.sessionId);
      if (session && session.browser) {
        try {
          await session.browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
      activeSessions.delete(req.body.sessionId);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old sessions
function cleanupOldSessions() {
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.timestamp > TEN_MINUTES) {
      console.log('Cleaning up old session:', sessionId);
      if (session.browser) {
        session.browser.close().catch(console.error);
      }
      activeSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldSessions, 5 * 60 * 1000);

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});
