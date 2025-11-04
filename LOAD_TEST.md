# Load Testing Guide

This document explains how to run load tests on the RSVP system to verify multi-dyno performance, sticky sessions, and Redis integration.

## Quick Start

### Run Load Test (5 concurrent requests - default)
```bash
npm run load-test
```

### Test Against Local Server
```bash
npm run load-test:local
```

### Heavy Load Test (10 concurrent requests)
```bash
npm run load-test:heavy
```

## Custom Configuration

You can customize the load test using environment variables:

```bash
# Custom number of concurrent requests
NUM_REQUESTS=20 npm run load-test

# Custom target URL
APP_URL=https://your-app.herokuapp.com npm run load-test

# Test session completion (with dummy captcha - will fail validation)
TEST_COMPLETE=true npm run load-test

# Combine multiple options
NUM_REQUESTS=15 APP_URL=https://staging-app.herokuapp.com npm run load-test
```

## What the Load Test Does

1. **Pre-Test Health Check**: Verifies server is running and Redis is connected
2. **Simultaneous Requests**: Sends N concurrent RSVP initialization requests
3. **Result Analysis**: Tracks success rate, response times, and dyno distribution
4. **Post-Test Health Check**: Verifies server is still healthy after load

## Understanding the Results

### Sample Output

```
Total Requests:      5
Successful:          5 (100.0%)
Failed:              0 (0.0%)

Total Time:          29885ms
Avg Response Time:   29455ms
Min Response Time:   29200ms
Max Response Time:   29882ms

Unique Dynos Used:   2
Dyno IDs:            web.1, web.2

Requests per Dyno:
  web.1: 3 requests
  web.2: 2 requests
```

### Key Metrics

#### Success Rate
- **100%**: Perfect - all requests succeeded
- **80-99%**: Good - some requests may have hit queue limits or timeout
- **<80%**: Issue - check server logs for errors

#### Response Times
- **10-30 seconds**: Normal - Puppeteer browser initialization takes time
- **>60 seconds**: Slow - may indicate resource exhaustion or network issues
- **Variation**: High variation (>10s difference) suggests queueing is working

#### Dyno Distribution
- **Single Dyno**: Normal for low load or if app hasn't scaled yet
- **Multiple Dynos**: Good - shows Heroku is load balancing
- **Sticky Sessions**: Each unique user should hit the same dyno for both init and complete requests

## Queue Behavior

The system has a queue to prevent resource exhaustion:

- **MAX_CONCURRENT_BROWSERS**: 3 per dyno (configurable in server.js)
- **Queue Limit**: 20 pending requests (configurable in server.js)
- **Behavior**: Requests beyond the concurrent limit wait in queue

### Expected Behavior for 5 Requests

With `MAX_CONCURRENT_BROWSERS=3`:
1. First 3 requests start immediately
2. Requests 4-5 wait in queue
3. As requests complete, queued requests start
4. Total time should be roughly 2 batches worth

### Queue Test Example

```bash
# Test with 10 requests to see queueing in action
NUM_REQUESTS=10 npm run load-test
```

With 3 concurrent browsers per dyno:
- 10 requests on 1 dyno: ~4 batches (30s, 30s, 30s, 30s) = ~120s total
- 10 requests on 2 dynos: ~2 batches per dyno = ~60s total
- 10 requests on 3 dynos: ~1-2 batches per dyno = ~30-60s total

## Testing Sticky Sessions

Sticky sessions ensure that both RSVP steps (init and complete) go to the same dyno.

### Manual Test

1. Run load test to get session IDs
2. Try completing with the session IDs
3. Check that completion succeeds (or fails gracefully)

```bash
# Get session IDs from load test output
npm run load-test

# Manually test completion (will fail captcha validation, but session should be found)
curl -X POST https://your-app.herokuapp.com/api/complete-rsvp \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session_123_abc", "captchaAnswer": "test"}'
```

**Expected results:**
- ✅ With sticky sessions: "Invalid captcha" (session found, captcha wrong)
- ❌ Without sticky sessions: "Session data lost" (session not found on this dyno)

## Troubleshooting

### All Requests Fail

**Symptoms**: 0% success rate

**Possible causes:**
1. Server is down
2. URL is wrong
3. Redis is not connected

**Fix:**
```bash
# Check health endpoint
curl https://your-app.herokuapp.com/api/health

# Check Redis
heroku redis:info -a your-app-name

# Check logs
heroku logs --tail -a your-app-name
```

### "Server is too busy" Errors

**Symptoms**: Some requests return 503 status

**Cause**: Queue is full (>20 pending requests)

**Fix:**
1. Reduce `NUM_REQUESTS`
2. Increase `MAX_CONCURRENT_BROWSERS` in server.js
3. Add more dynos

### "Session data lost" Errors (During Completion)

**Symptoms**: Complete RSVP fails with session lost error

**Cause**: Sticky sessions not enabled or dyno restarted

**Fix:**
```bash
# Enable sticky sessions
heroku features:enable http-session-affinity -a your-app-name

# Verify it's enabled
heroku features -a your-app-name | grep session-affinity
```

### High Response Times (>60s)

**Symptoms**: Avg response time >60 seconds

**Possible causes:**
1. Not enough dynos for the load
2. Dyno type too small (needs more RAM)
3. Network issues

**Fix:**
1. Scale up: `heroku ps:scale web=5 -a your-app-name`
2. Upgrade dyno type: Performance-M → Performance-L
3. Increase `MAX_CONCURRENT_BROWSERS` if dyno has spare resources

## Production Load Testing Best Practices

### Start Small
```bash
# Start with light load
NUM_REQUESTS=3 npm run load-test
```

### Gradually Increase
```bash
# Increase gradually
NUM_REQUESTS=5 npm run load-test
NUM_REQUESTS=10 npm run load-test
NUM_REQUESTS=20 npm run load-test
```

### Monitor During Test
```bash
# Watch logs in another terminal
heroku logs --tail -a your-app-name

# Watch dyno metrics
heroku ps -a your-app-name
```

### Test Peak Load
Calculate expected peak load:
- Event duration: 2 hours
- Expected attendees: 500 people
- Concentrated in first 30 minutes: 250 people
- Concurrent users (assume 10% overlap): 25 concurrent

```bash
NUM_REQUESTS=25 npm run load-test
```

## Understanding Multi-Dyno Behavior

### Scenario 1: Single Dyno
- All 5 requests go to same dyno
- Queue manages concurrency
- Expected time: ~60-90s (2-3 batches)

### Scenario 2: Multiple Dynos (2-4 dynos)
- Requests distributed across dynos
- Each dyno has its own queue
- Expected time: ~30-60s (1-2 batches per dyno)
- Sticky sessions ensure same user stays on same dyno

### Scenario 3: Auto-scaling (1-10 dynos)
- Heroku adds dynos as load increases
- First few requests may trigger scaling
- Subsequent requests benefit from additional capacity

## Advanced Testing

### Sustained Load Test

For testing session cleanup and memory management:

```bash
# Run multiple rounds with delays
for i in {1..5}; do
  echo "Round $i"
  NUM_REQUESTS=10 npm run load-test
  sleep 60
done
```

### Stress Test (Find Breaking Point)

```bash
# Gradually increase until failures occur
for n in 5 10 15 20 25 30; do
  echo "Testing with $n requests..."
  NUM_REQUESTS=$n npm run load-test
  sleep 30
done
```

## Integration with CI/CD

Add to your deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Heroku
  run: git push heroku main

- name: Run smoke test
  run: npm run load-test

- name: Check results
  run: |
    if [ $? -ne 0 ]; then
      echo "Load test failed! Rolling back..."
      heroku releases:rollback -a your-app-name
      exit 1
    fi
```

## Support

If you encounter issues:

1. Check `SCALING.md` for multi-dyno configuration
2. Review Heroku logs: `heroku logs --tail -a your-app-name`
3. Verify Redis: `heroku redis:info -a your-app-name`
4. Check dyno status: `heroku ps -a your-app-name`
