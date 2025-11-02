const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const RSVP_URL = 'https://rsvp.hikvision.lk:8088/#/?nature=h5&app=Visitor&type=selfEntryVisitor&UserID=1';

/**
 * Initialize RSVP - Fill form fields and capture captcha
 */
async function initializeRSVP(formData) {
  let browser;
  let page;

  try {
    console.log('Launching browser...');

    // Use Chrome binary from buildpack on Heroku, otherwise use default
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };

    // On Heroku, use Chrome from buildpack
    // Chrome for Testing buildpack path
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

    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

    // Set viewport to mobile size
    await page.setViewport({ width: 375, height: 812 });

    // Enable request interception to handle SSL issues
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });

    console.log('Navigating to RSVP page...');
    await page.goto(RSVP_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for page to fully load
    await page.waitForTimeout(5000);

    console.log('Page loaded, filling form...');

    // Debug: Log all form fields
    const formFields = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      return Array.from(inputs).map((input, index) => ({
        index,
        tag: input.tagName.toLowerCase(),
        type: input.type || 'N/A',
        name: input.name || 'N/A',
        id: input.id || 'N/A',
        placeholder: input.placeholder || 'N/A',
        className: input.className || 'N/A'
      }));
    });
    console.log('=== FORM FIELDS FOUND ===');
    console.log(JSON.stringify(formFields, null, 2));

    // Upload photo
    console.log('Uploading photo...');
    const photoBuffer = Buffer.from(formData.photo.split(',')[1], 'base64');
    const tempPhotoPath = path.join(__dirname, `temp_photo_${Date.now()}.jpg`);
    await fs.writeFile(tempPhotoPath, photoBuffer);

    // Find and upload photo
    const photoInput = await page.$('input[type="file"]');
    if (photoInput) {
      await photoInput.uploadFile(tempPhotoPath);
      await page.waitForTimeout(3000); // Wait longer for upload to process
      console.log('Photo uploaded');

      // Clean up temp file
      await fs.unlink(tempPhotoPath).catch(console.error);
    } else {
      throw new Error('Photo upload field not found');
    }

    // Fill First Name (GivenName)
    console.log('Filling first name...');
    await fillField(page, [
      '.hm-cell[prop="GivenName"] input.hm-input-field',
      '[prop="GivenName"] input',
      'div[prop="GivenName"] input.hm-input-field'
    ], formData.firstName, 'First Name');

    // Fill Last Name (FamilyName)
    console.log('Filling last name...');
    await fillField(page, [
      '.hm-cell[prop="FamilyName"] input.hm-input-field',
      '[prop="FamilyName"] input',
      'div[prop="FamilyName"] input.hm-input-field'
    ], formData.lastName, 'Last Name');

    // Fill Phone (PhoneNum)
    console.log('Filling phone...');
    await fillField(page, [
      '.hm-cell[prop="PhoneNum"] input.hm-input-field',
      '[prop="PhoneNum"] input',
      'div[prop="PhoneNum"] input.hm-input-field'
    ], formData.phone, 'Phone');

    // Fill Email
    console.log('Filling email...');
    await fillField(page, [
      '.hm-cell[prop="Email"] input.hm-input-field',
      '[prop="Email"] input',
      'div[prop="Email"] input.hm-input-field'
    ], formData.email, 'Email');

    // Fill Organization (CompanyName)
    console.log('Filling organization...');
    await fillField(page, [
      '.hm-cell[prop="CompanyName"] input.hm-input-field',
      '[prop="CompanyName"] input',
      'div[prop="CompanyName"] input.hm-input-field'
    ], formData.organization, 'Organization');

    // Visit purpose is already set to "Business" by default in the HTML
    console.log('Visit purpose already set to Business (default)');

    // Date/time pickers are custom components that need clicking
    // The dates shown are: Start: 2025/11/07 - 00:00, End: 2025/11/02 - 23:59
    // Since these are custom pickers, we'll try to interact with them
    console.log('Setting visit dates...');
    await setVisitDates(page);

    // Wait for captcha to load (important!)
    console.log('Waiting for captcha to load...');
    await page.waitForTimeout(5000); // Increased wait time

    // Capture captcha image
    console.log('Capturing captcha image...');
    const captchaImage = await captureCaptcha(page);

    if (!captchaImage) {
      throw new Error('Could not capture captcha image');
    }

    console.log('Form filled successfully, captcha captured');

    // Return page and browser to keep session alive
    return {
      page,
      browser,
      captchaImage
    };
  } catch (error) {
    console.error('Error initializing RSVP:', error);

    // Take screenshot for debugging
    if (page) {
      try {
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        console.log('Error screenshot captured');
      } catch (e) {
        console.error('Could not capture error screenshot:', e);
      }
    }

    // Clean up on error - don't await to prevent hanging
    if (browser) {
      Promise.race([
        browser.close(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).catch(err => console.error('Error closing browser:', err));
    }

    throw error;
  }
}

/**
 * Complete RSVP with captcha answer
 */
async function completeRSVP(page, browser, captchaAnswer) {
  try {
    console.log('Entering captcha answer:', captchaAnswer);

    // Find captcha input field and fill it
    const captchaFilled = await fillField(page, [
      '.b-code-row input.hm-input-field',
      '.input-code input.hm-input-field',
      '.action-bottom input.hm-input-field'
    ], captchaAnswer, 'Captcha');

    if (!captchaFilled) {
      throw new Error('Could not find captcha input field');
    }

    await page.waitForTimeout(1000);

    // Find and click submit button (Save button)
    console.log('Clicking submit button...');
    const submitClicked = await clickButton(page, [
      'button.hm-btn',
      '.action-bottom button',
      'button[type="button"]'
    ]);

    if (!submitClicked) {
      throw new Error('Could not find submit button');
    }

    // Wait for submission response with timeout
    console.log('Waiting for submission response (max 10 seconds)...');

    try {
      // Wait for either success (QR code) or error dialog to appear
      await Promise.race([
        // Wait for QR code (success)
        page.waitForSelector('img.codeImg', { timeout: 10000 }),
        // Wait for error dialog
        page.waitForSelector('.hm-dialog-content-def', { timeout: 10000 })
      ]);
    } catch (error) {
      // Timeout after 10 seconds
      console.error('Timeout waiting for response');
      throw new Error('Submission timeout. No response received after 10 seconds. Please check manually.');
    }

    // Check for success (QR code and reservation code)
    const successData = await page.evaluate(() => {
      // Look for QR code image
      const qrCodeImg = document.querySelector('img.codeImg');
      const qrCodeSrc = qrCodeImg ? qrCodeImg.src : null;

      // Look for reservation code
      const reservationTextElement = document.querySelector('.text[title*="Reservation Code"]');
      const reservationCode = reservationTextElement
        ? reservationTextElement.textContent.replace('Reservation Code：', '').trim()
        : null;

      // Look for success toast
      const toast = document.querySelector('.hm-toast-fade');
      const toastText = toast ? toast.textContent.trim() : '';

      // Look for error dialog
      const errorDialog = document.querySelector('.hm-dialog-content-def p');
      const errorMessage = errorDialog ? errorDialog.textContent.trim() : null;

      return {
        qrCodeSrc,
        reservationCode,
        toastText,
        errorMessage,
        hasQRCode: !!qrCodeSrc,
        hasError: !!errorMessage
      };
    });

    console.log('Submission result:', JSON.stringify({
      hasQRCode: successData.hasQRCode,
      reservationCode: successData.reservationCode,
      toastText: successData.toastText,
      hasError: successData.hasError,
      errorMessage: successData.errorMessage
    }, null, 2));

    // Check for errors
    if (successData.hasError) {
      throw new Error(successData.errorMessage || 'Submission failed. Please check your information.');
    }

    // Check for success
    if (!successData.hasQRCode) {
      throw new Error('Submission completed but QR code not found. Please check manually.');
    }

    // Take final screenshot
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });

    const message = successData.toastText || 'RSVP submitted successfully!';
    console.log('✓ Submission completed:', message);

    // Prepare response data
    const responseData = {
      success: true,
      message,
      qrCode: successData.qrCodeSrc,
      reservationCode: successData.reservationCode,
      screenshot: `data:image/png;base64,${screenshot}`
    };

    // Clean up browser - don't await to prevent hanging
    // Close browser in background with timeout
    Promise.race([
      browser.close(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]).catch(err => console.error('Error closing browser:', err));

    return responseData;
  } catch (error) {
    console.error('Error completing RSVP:', error);

    // Take error screenshot
    if (page) {
      try {
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        console.log('Error screenshot captured');
      } catch (e) {
        console.error('Could not capture screenshot:', e);
      }
    }

    // Clean up browser - don't await to prevent hanging
    if (browser) {
      Promise.race([
        browser.close(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).catch(err => console.error('Error closing browser:', err));
    }

    throw error;
  }
}

/**
 * Helper function to fill a field using multiple selector strategies
 */
async function fillField(page, selectors, value, fieldName = 'field') {
  // Try all provided selectors first
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        // Check if field is visible and enabled
        const isVisible = await element.isVisible().catch(() => true);
        if (!isVisible) continue;

        await element.click({ clickCount: 3 }); // Select all existing text
        await page.waitForTimeout(100);
        await element.type(value, { delay: 50 }); // Type with delay
        console.log(`✓ ${fieldName} filled with selector: ${selector}`);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback: Try to find by evaluating all text inputs
  console.log(`Trying fallback method for ${fieldName}...`);
  const filled = await page.evaluate((val, name) => {
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea'));

    // Try to find by nearby label text
    for (const input of inputs) {
      const label = input.parentElement?.querySelector('label')?.textContent?.toLowerCase() || '';
      const placeholder = (input.placeholder || '').toLowerCase();

      if (label.includes(name.toLowerCase()) || placeholder.includes(name.toLowerCase())) {
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, value, fieldName);

  if (filled) {
    console.log(`✓ ${fieldName} filled using fallback method`);
    return true;
  }

  console.warn(`✗ ${fieldName} field not found with any method`);
  return false;
}

/**
 * Helper function to click a button using multiple selector strategies
 */
async function clickButton(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        console.log(`Clicked button with selector: ${selector}`);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // Try finding by text content
  try {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      const submitBtn = buttons.find(btn =>
        btn.textContent.toLowerCase().includes('submit') ||
        btn.textContent.toLowerCase().includes('confirm') ||
        btn.textContent.toLowerCase().includes('register') ||
        btn.value?.toLowerCase().includes('submit')
      );
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      console.log('Clicked submit button by text content');
      return true;
    }
  } catch (e) {
    console.error('Error clicking by text:', e);
  }

  return false;
}

/**
 * Select visit purpose
 */
async function selectVisitPurpose(page, purpose) {
  try {
    // Try to find and select dropdown/radio for visit purpose
    const selected = await page.evaluate((purposeValue) => {
      // Try select dropdown
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.options);
        const businessOption = options.find(opt =>
          opt.text.toLowerCase().includes('business') ||
          opt.value.toLowerCase().includes('business')
        );
        if (businessOption) {
          select.value = businessOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      // Try radio buttons
      const radios = document.querySelectorAll('input[type="radio"]');
      for (const radio of radios) {
        const label = radio.parentElement?.textContent || '';
        if (label.toLowerCase().includes('business')) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      return false;
    }, purpose);

    if (selected) {
      console.log('Visit purpose set to business');
    }
  } catch (e) {
    console.error('Error selecting visit purpose:', e);
  }
}

/**
 * Set visit date/time range
 * The page uses custom pickers (hm-picker) with dropdown wheels
 */
async function setVisitDates(page) {
  try {
    console.log('Setting start date to Nov 7, 2025 00:00...');

    // Click start date to open picker
    await page.click('.datetime-start .date-time');
    await page.waitForTimeout(1000);

    // Set start date values in the picker
    await page.evaluate(() => {
      // Find the picker that just opened
      const pickers = document.querySelectorAll('.hm-picker');
      for (const picker of pickers) {
        const title = picker.querySelector('.hm-picker-title');
        if (title && title.textContent.includes('Start')) {
          // Find all wheel scrolls
          const wheels = picker.querySelectorAll('.hm-picker-wheel-scroll');
          if (wheels.length >= 5) {
            // Year wheel (index 0) - select 2025
            const yearItems = wheels[0].querySelectorAll('.hm-picker-wheel-item');
            yearItems[0].click(); // 2025 is first in the list

            // Month wheel (index 1) - select 11 (November)
            const monthItems = wheels[1].querySelectorAll('.hm-picker-wheel-item');
            monthItems[0].click(); // 11 is first option

            // Day wheel (index 2) - select 7
            const dayItems = wheels[2].querySelectorAll('.hm-picker-wheel-item');
            if (dayItems.length >= 6) {
              dayItems[5].click(); // 7 is at index 5 (starts from 2)
            }

            // Hour wheel (index 3) - select 00
            const hourItems = wheels[3].querySelectorAll('.hm-picker-wheel-item');
            hourItems[0].click(); // 00

            // Minute wheel (index 4) - select 00
            const minuteItems = wheels[4].querySelectorAll('.hm-picker-wheel-item');
            hourItems[0].click(); // 00
          }
        }
      }
    });

    await page.waitForTimeout(500);

    // Click OK to confirm start date
    await page.evaluate(() => {
      const pickers = document.querySelectorAll('.hm-picker');
      for (const picker of pickers) {
        const title = picker.querySelector('.hm-picker-title');
        if (title && title.textContent.includes('Start')) {
          const okBtn = picker.querySelector('.hm-picker-confirm');
          if (okBtn) okBtn.click();
        }
      }
    });

    await page.waitForTimeout(1000);
    console.log('✓ Start date set');

    // Now set end date
    console.log('Setting end date to Nov 8, 2025 23:59...');

    // Click end date to open picker
    const endDateSelectors = [
      '.datetime-container:nth-of-type(2) .date-time',
      '.datetime-container:last-child .date-time'
    ];

    for (const selector of endDateSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    await page.waitForTimeout(1000);

    // Set end date values
    await page.evaluate(() => {
      const pickers = document.querySelectorAll('.hm-picker');
      for (const picker of pickers) {
        const title = picker.querySelector('.hm-picker-title');
        if (title && title.textContent.includes('End')) {
          const wheels = picker.querySelectorAll('.hm-picker-wheel-scroll');
          if (wheels.length >= 5) {
            // Year - 2025
            const yearItems = wheels[0].querySelectorAll('.hm-picker-wheel-item');
            yearItems[0].click();

            // Month - 11
            const monthItems = wheels[1].querySelectorAll('.hm-picker-wheel-item');
            monthItems[0].click();

            // Day - 8
            const dayItems = wheels[2].querySelectorAll('.hm-picker-wheel-item');
            if (dayItems.length >= 7) {
              dayItems[6].click(); // 8 is at index 6
            }

            // Hour - 23
            const hourItems = wheels[3].querySelectorAll('.hm-picker-wheel-item');
            if (hourItems.length >= 24) {
              hourItems[23].click();
            }

            // Minute - 59
            const minuteItems = wheels[4].querySelectorAll('.hm-picker-wheel-item');
            if (minuteItems.length >= 60) {
              minuteItems[59].click();
            }
          }
        }
      }
    });

    await page.waitForTimeout(500);

    // Click OK to confirm end date
    await page.evaluate(() => {
      const pickers = document.querySelectorAll('.hm-picker');
      for (const picker of pickers) {
        const title = picker.querySelector('.hm-picker-title');
        if (title && title.textContent.includes('End')) {
          const okBtn = picker.querySelector('.hm-picker-confirm');
          if (okBtn) okBtn.click();
        }
      }
    });

    await page.waitForTimeout(1000);
    console.log('✓ End date set');

  } catch (e) {
    console.error('Error setting visit dates:', e);
    console.log('⚠ Continuing without date changes - please verify dates manually');
  }
}

/**
 * Capture captcha image from the page
 */
async function captureCaptcha(page) {
  try {
    console.log('Searching for captcha image...');

    // Try to find the captcha image using the specific class
    const captchaBase64 = await page.evaluate(() => {
      // First, try the specific captcha image class
      const captchaImg = document.querySelector('img.img-validate-code');
      if (captchaImg && captchaImg.src) {
        return captchaImg.src;
      }

      // Fallback: look for canvas
      const canvas = document.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL();
      }

      return null;
    });

    if (captchaBase64) {
      console.log('✓ Captcha image captured successfully');
      return captchaBase64;
    }

    // Fallback: Take a screenshot and let user identify the captcha area
    console.warn('Could not find captcha image, taking full page screenshot...');
    console.warn('You may need to manually inspect the page to find the captcha selector');

    const screenshot = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      fullPage: true
    });

    // Save debug info
    console.log('CAPTCHA NOT FOUND - Check the screenshot returned to frontend');
    console.log('Available images:', imageInfo.length);

    return `data:image/png;base64,${screenshot}`;
  } catch (e) {
    console.error('Error capturing captcha:', e);
    return null;
  }
}

module.exports = {
  initializeRSVP,
  completeRSVP
};
