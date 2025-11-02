# Quick Start Guide

Complete Hikvision Event RSVP System with automated form filling and captcha handling.

## Prerequisites

- Node.js 18+ installed
- Chrome/Chromium (automatically downloaded by Puppeteer)
- Photo in `resource/photo.jpg` for testing

## Installation

```bash
npm install
```

## Testing the Application

### Step 1: Start Backend Server

Open a terminal:

```bash
npm start
```

You should see:
```
🚀 Server running on port 3000
📱 Frontend: http://localhost:3000
🔌 API: http://localhost:3000/api
```

### Step 2: Start Test Frontend (in another terminal)

Open a **new terminal** window:

```bash
npm test
```

You should see:
```
🧪 Visual Test Server Running
📱 Open: http://localhost:8080
```

### Step 3: Open Browser

Navigate to: **http://localhost:8080**

### Step 4: Test the Flow

1. Click **"Load Dummy Photo"** button (uses `resource/photo.jpg`)
2. Verify form is pre-filled with test data
3. Click **"Continue"**
4. Wait for real captcha to load from Hikvision server
5. Solve the captcha puzzle
6. Click **"Submit RSVP"**
7. See success confirmation

## What Happens Behind the Scenes

1. **Frontend (port 8080)** collects user data
2. **POST /api/init-rsvp** → Backend launches Puppeteer
3. **Backend** navigates to Hikvision RSVP page
4. **Backend** fills all form fields (photo, name, email, etc.)
5. **Backend** sets visit dates (Nov 7-8, 2025)
6. **Backend** captures real captcha image
7. **Frontend** displays captcha to user
8. **User** solves captcha
9. **POST /api/complete-rsvp** → Backend submits with answer
10. **Backend** returns success/failure response

## Production Use

To use the main frontend (not test mode):

```bash
npm start
```

Then open: **http://localhost:3000**

This serves the production frontend with the same backend.

## File Structure

```
hikevent/
├── backend/
│   ├── server.js          # Express API server
│   └── scraper.js         # Puppeteer automation
├── frontend/
│   ├── index.html         # Production frontend
│   ├── app.js            # Production logic
│   ├── test.html         # Test page with controls
│   ├── test-app.js       # Test logic
│   └── style.css         # Shared styles
├── resource/
│   └── photo.jpg         # Test photo
├── test-server.js        # Test server with proxy
├── package.json
└── README.md
```

## Environment Variables

Create `.env` file (optional):

```
PORT=3000
NODE_ENV=development
```

## Common Issues

### Port already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Change port in .env file
PORT=3001
```

### Puppeteer fails on Heroku
Add buildpack:
```bash
heroku buildpacks:add jontewks/puppeteer
heroku buildpacks:add heroku/nodejs
```

### Photo doesn't upload
- Ensure `resource/photo.jpg` exists
- Check file is under 5MB
- Verify it's a valid image format

### Captcha not displaying
- Ensure backend is running
- Check console for errors
- Verify network connectivity to rsvp.hikvision.lk

## API Endpoints

### GET /api/health
Health check

### POST /api/init-rsvp
Initialize RSVP, fill form, get captcha

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+94 77 123 4567",
  "email": "john@example.com",
  "organization": "Tech Solutions",
  "photo": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_123...",
  "captchaImage": "data:image/png;base64,..."
}
```

### POST /api/complete-rsvp
Complete RSVP with captcha answer

**Request:**
```json
{
  "sessionId": "session_123...",
  "captchaAnswer": "answer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "confirmationMessage": "Registration successful!",
    "screenshot": "data:image/png;base64,..."
  }
}
```

## Heroku Deployment

```bash
# Login
heroku login

# Create app
heroku create your-app-name

# Add buildpacks
heroku buildpacks:add jontewks/puppeteer
heroku buildpacks:add heroku/nodejs

# Deploy
git push heroku main

# Open app
heroku open
```

## Support

- See `README.md` for detailed documentation
- See `TESTING.md` for testing guide
- Check console logs for debugging
- Inspect network tab for API calls

## Event Details

- **Event**: Hikvision Event
- **Dates**: November 7-8, 2025
- **Visit Purpose**: Business (auto-selected)
- **Time**: Nov 7 00:00 to Nov 8 23:59 (auto-set)
