# Visual Testing Guide

This guide will help you test the complete RSVP flow with real backend integration.

## Quick Start

### 1. Start the Backend Server

Open a terminal and run:

```bash
npm start
```

This starts the backend API server on port 3000.

### 2. Start the Test Frontend Server

Open **another terminal** (keep the first one running) and run:

```bash
npm test
```

This starts the frontend test server on port 8080, which proxies API calls to the backend.

### 3. Open in Browser

Navigate to:
```
http://localhost:8080
```

The test page will load with dummy data pre-filled and will make real API calls to the backend.

## Test Features

### Test Controls Panel

Located in the bottom-right corner of the page, you'll find these controls:

- **Load Dummy Photo** - Automatically loads the photo from `resource/photo.jpg`
- **Jump to Captcha** - Skip directly to the captcha verification step
- **Jump to Success** - Skip directly to the success confirmation page
- **Reset Form** - Reload the page and start fresh

### Test Flow

#### Step 1: User Information Form
- Pre-filled with dummy data (John Doe, etc.)
- Click "Load Dummy Photo" to use the photo from `resource/photo.jpg`
- Or upload your own photo via "Choose Photo" or "Take Photo"
- Click "Continue" to proceed

#### Step 2: Captcha Verification
- Real captcha image is fetched from the Hikvision RSVP page via backend
- Solve the puzzle shown in the image
- Enter the answer and click "Submit RSVP"
- Wrong answers will show an error message
- The backend keeps the browser session alive between steps

#### Step 3: Success Confirmation
- Displays all submitted information
- Shows a success message
- Option to register another person

## Testing Different Scenarios

### Test Photo Upload

1. Click "Choose Photo" to select from your computer
2. Click "Take Photo" to use your device camera (mobile only)
3. Photo preview shows immediately after selection
4. File size validation: max 5MB
5. File type validation: images only

### Test Form Validation

1. Try submitting without a photo - should show error
2. Try submitting with empty fields - should show error
3. Try invalid email format - should show error
4. All validations show user-friendly messages

### Test Responsive Design

1. Resize browser window to different sizes
2. Test on mobile device (portrait and landscape)
3. Use browser DevTools device emulation
4. All elements should adapt properly

### Test Captcha Flow

1. Jump to captcha step using test controls
2. Try entering wrong answer - should show error
3. Enter correct answer - should proceed to success
4. Click "Back" - should return to form without losing data

## Dummy Data Used

```
First Name: John
Last Name: Doe
Phone: +94 77 123 4567
Email: john.doe@example.com
Organization: Tech Solutions Ltd
Photo: resource/photo.jpg
Event Dates: November 7-8, 2025
Visit Purpose: Business (auto-selected)
```

## File Structure

```
frontend/
├── test.html         # Visual test page
├── test-app.js       # Test mode logic with mocks
├── index.html        # Production page
├── app.js           # Production logic
├── style.css        # Shared styles
test-server.js       # Simple HTTP server for testing
resource/
└── photo.jpg        # Dummy photo for testing
```

## Tips for Testing

1. **Chrome DevTools**: Open with F12 to see console logs
2. **Mobile Testing**: Use Chrome DevTools device toolbar (Ctrl+Shift+M)
3. **Network Tab**: View the mock API calls in console
4. **Screenshot Testing**: Take screenshots at each step for documentation
5. **Accessibility**: Test with keyboard navigation (Tab, Enter)

## What Gets Tested

1. **Full Backend Integration**: Complete API workflow
2. **Real Form Submission**: Actual submission to Hikvision RSVP server
3. **Real Captcha**: Extracts and displays the actual captcha from the target page
4. **Photo Upload**: Tests file upload and base64 encoding
5. **Session Management**: Tests the two-step submission process
6. **Error Handling**: Tests validation and error messages

## Next Steps After Visual Testing

Once visual testing is complete:

1. Ensure `resource/photo.jpg` exists and is a valid face photo
2. Test the actual backend integration with `npm start`
3. Test the real Hikvision RSVP form submission
4. Verify the captcha extraction works correctly
5. Check the final submission response

## Troubleshooting

### Photo doesn't load
- Check that `resource/photo.jpg` exists
- Verify the file path is correct
- Open browser console to see error messages

### Server won't start
- Make sure port 8080 is available
- Try a different port by editing `test-server.js`
- Check that Node.js is installed

### Styles don't apply
- Clear browser cache (Ctrl+Shift+R)
- Check that `style.css` is in the frontend folder
- Verify no browser extensions are blocking CSS

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Android)

## Reporting Issues

If you find any visual bugs or issues during testing:

1. Note the browser and version
2. Take a screenshot
3. Check browser console for errors
4. Document steps to reproduce
5. Test on a different browser to confirm
