# Hikvision Event RSVP System

A full-stack web application for automating RSVP submissions to the Hikvision event registration system. Built with Node.js, Express, Puppeteer, and vanilla JavaScript.

## Features

- Clean, responsive frontend form for collecting attendee information
- Backend automation using Puppeteer to interact with the Hikvision RSVP page
- RESTful API for form submission and testing
- Easy deployment to Heroku
- Debug mode for inspecting the target RSVP page

## Project Structure

```
hikevent/
├── backend/
│   ├── server.js          # Express server
│   └── scraper.js         # Puppeteer automation logic
├── frontend/
│   ├── index.html         # Main HTML page
│   ├── style.css          # Styling
│   └── app.js             # Frontend JavaScript
├── package.json           # Dependencies and scripts
├── Procfile              # Heroku deployment config
├── .env.example          # Environment variables template
└── README.md             # This file
```

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Heroku CLI (for deployment)

## Local Development Setup

### 1. Clone or navigate to the project directory

```bash
cd hikevent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file (optional)

```bash
cp .env.example .env
```

Edit `.env` if you need to customize the PORT or other settings.

### 4. Run the development server

```bash
npm run dev
```

Or for production mode:

```bash
npm start
```

### 5. Open your browser

Navigate to `http://localhost:3000`

## API Endpoints

### GET /api/health
Check server status

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### GET /api/test-connection
Test connection to the Hikvision RSVP site and analyze the page structure

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Page Title",
    "url": "Current URL",
    "screenshot": "base64 encoded screenshot"
  }
}
```

### POST /api/submit-rsvp
Submit RSVP data

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+94 XX XXX XXXX",
  "company": "Company Name",
  "designation": "Job Title",
  "comments": "Additional comments"
}
```

**Response:**
```json
{
  "success": true,
  "message": "RSVP submitted successfully",
  "data": { ... }
}
```

## Heroku Deployment

### 1. Install Heroku CLI

Download from: https://devcenter.heroku.com/articles/heroku-cli

### 2. Login to Heroku

```bash
heroku login
```

### 3. Create a new Heroku app

```bash
heroku create your-app-name
```

### 4. Add Puppeteer buildpack

Heroku needs a special buildpack to run Puppeteer:

```bash
heroku buildpacks:add jontewks/puppeteer
heroku buildpacks:add heroku/nodejs
```

### 5. Deploy to Heroku

```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

Or if you're on master branch:

```bash
git push heroku master
```

### 6. Open your app

```bash
heroku open
```

### 7. View logs (if needed)

```bash
heroku logs --tail
```

## Customization Guide

### Updating Form Fields

The current implementation includes a form analysis feature. To customize the form filling logic:

1. Run the app and click "Test Connection" to see the available form fields
2. Update `backend/scraper.js` in the `submitRSVP` function with the actual selectors
3. Modify the form filling logic based on the discovered input fields

Example:
```javascript
// In backend/scraper.js
await page.type('#name-field-id', formData.name);
await page.type('#email-field-id', formData.email);
await page.click('#submit-button-id');
```

### Adding More Form Fields

1. Update `frontend/index.html` to add new input fields
2. Update `frontend/app.js` to include the new fields in formData
3. Update `backend/scraper.js` to handle the new fields

### Styling Customization

Edit `frontend/style.css` to customize colors, fonts, and layout. Key CSS variables are defined in `:root`:

```css
:root {
    --primary-color: #e60012;
    --primary-dark: #cc0010;
    /* ... more variables */
}
```

## Troubleshooting

### Puppeteer fails on Heroku
- Make sure you've added the Puppeteer buildpack
- Check that the buildpack order is correct (Puppeteer before Node.js)

### Connection timeout
- The Hikvision RSVP site might be slow or unavailable
- Increase timeout values in `backend/scraper.js`

### Form submission not working
- Use the "Test Connection" feature to inspect the page structure
- Update the selectors in `scraper.js` based on the actual form fields

## Development Scripts

- `npm start` - Run production server
- `npm run dev` - Run development server with auto-reload
- `npm run install-all` - Install all dependencies

## Technologies Used

- **Backend:** Node.js, Express.js, Puppeteer
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Deployment:** Heroku
- **Automation:** Puppeteer for browser automation

## Security Notes

- Never commit `.env` files with sensitive data
- The app uses CORS - restrict it in production if needed
- Puppeteer runs in sandboxed mode by default

## Next Steps

1. Test the connection to analyze the Hikvision RSVP form structure
2. Update the scraper logic with actual form selectors
3. Test form submission locally
4. Deploy to Heroku
5. Test the deployed application

## License

ISC

## Support

For issues or questions, please create an issue in the repository.
