# Scaling Guide for Hikvision Event RSVP

## Multi-Dyno Setup

This application is configured to run with auto-scaling up to 10 dynos on Heroku.

### Required Configuration

#### 1. Redis Setup (CRITICAL for multi-dyno)

Redis is **required** for session storage across multiple dynos. Without it, users will experience random failures.

**Add Redis to your Heroku app:**

```bash
# Option 1: Heroku Redis (Recommended)
heroku addons:create heroku-redis:mini -a your-app-name

# Option 2: Redis Cloud (free tier available)
heroku addons:create rediscloud:30 -a your-app-name
```

The `REDIS_URL` environment variable will be automatically set by Heroku.

#### 2. Deploy the Updated Code

```bash
# Install new dependencies
npm install

# Commit and push to Heroku
git add .
git commit -m "Add Redis support and request queuing for scaling"
git push heroku master
```

#### 3. Verify Setup

Check that Redis is connected:

```bash
heroku logs --tail -a your-app-name
```

You should see: `✅ Redis connected - multi-dyno sessions enabled`

Or check the health endpoint:

```bash
curl https://your-app-name.herokuapp.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "queue": {
    "active": 0,
    "pending": 0,
    "maxConcurrent": 3
  },
  "redis": "connected"
}
```

## How It Works

### Session Management
- **Redis stores** session metadata (user form data, timestamps)
- **Local memory stores** browser/page references (cannot be serialized to Redis)
- Sessions automatically expire after 10 minutes
- Orphaned browsers are cleaned up every 2 minutes

### Request Queuing
- Maximum 3 concurrent browser instances per dyno
- Requests are queued if limit is reached
- Server rejects requests if queue exceeds 20
- Queue status visible in `/api/health` endpoint

### Auto-Scaling Behavior
- With 10 dynos, you can handle ~30 concurrent browser sessions (3 per dyno)
- Additional requests queue up
- Heroku routes requests to any available dyno
- Redis ensures session data is accessible from any dyno

## Performance Tuning

### Adjust Concurrent Browser Limit

Edit `backend/server.js:36`:

```javascript
const MAX_CONCURRENT_BROWSERS = 3; // Increase for Performance-L dynos
```

**Recommendations by dyno type:**
- Performance-M: 3 browsers (default)
- Performance-L: 5 browsers
- Performance-XL: 8 browsers

### Adjust Queue Limit

Edit `backend/server.js:201`:

```javascript
if (requestQueue.length > 20) { // Increase if needed
```

Higher limits allow more users to wait, but increase response times.

## Monitoring

### Check Queue Status
```bash
# Real-time logs
heroku logs --tail -a your-app-name

# Health check
curl https://your-app-name.herokuapp.com/api/health
```

### Key Metrics to Watch
- Active browsers per dyno (should stay ≤ MAX_CONCURRENT_BROWSERS)
- Queue length (high values indicate need for more dynos)
- Session cleanup (orphaned sessions indicate issues)

## Cost Optimization

### Dyno Scaling
Current setup: Auto-scale 1-10 dynos

**Adjust scaling based on traffic:**
```bash
# View current scaling
heroku ps:autoscale -a your-app-name

# Adjust if needed
heroku ps:autoscale:set web --min 2 --max 10 -a your-app-name
```

### Redis Plans
- **Heroku Redis Mini** ($15/month): Good for most use cases
- **Redis Cloud 30MB** (Free): Limited but sufficient for testing

## Troubleshooting

### "Session expired or invalid" errors
- **Cause**: Redis not connected or dyno routing issue
- **Fix**: Check Redis connection in logs, verify REDIS_URL is set

### "Server is too busy" errors
- **Cause**: Queue is full (>20 pending requests)
- **Fix**: Increase max dynos or MAX_CONCURRENT_BROWSERS

### "Session data lost" errors
- **Cause**: Browser instance lost (dyno restart, crash)
- **Fix**: This is expected on dyno restarts. User should retry.

### Memory issues
- **Cause**: Too many concurrent browsers
- **Fix**: Decrease MAX_CONCURRENT_BROWSERS or upgrade dyno type

## Important Notes

1. **Browser instances cannot survive dyno restarts** - Users must start over if a dyno restarts
2. **Session affinity (sticky sessions) is NOT recommended** - Let Heroku's router balance load naturally
3. **Redis connection should be monitored** - Application falls back to in-memory if Redis fails
4. **Graceful shutdown** is implemented - Browsers are closed cleanly on SIGTERM

## Development vs Production

**Development (without Redis):**
- Uses in-memory sessions
- Only works with single process
- You'll see: `⚠️ No REDIS_URL - using in-memory sessions (single dyno only)`

**Production (with Redis):**
- Uses Redis for sessions
- Works with multiple dynos
- You'll see: `✅ Redis connected - multi-dyno sessions enabled`
