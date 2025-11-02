// Simple HTTP server for visual testing with backend proxy
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BACKEND_PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Proxy API requests to backend
    if (req.url.startsWith('/api/')) {
        console.log('Proxying API request to backend...');
        proxyToBackend(req, res);
        return;
    }

    let filePath = '.' + req.url;

    // Default to test.html
    if (filePath === './') {
        filePath = './frontend/test.html';
    }

    // Handle frontend files
    if (filePath.startsWith('./frontend/') || filePath.startsWith('./resource/')) {
        // Keep the path as is
    } else if (!filePath.includes('.')) {
        filePath = './frontend/test.html';
    } else if (!filePath.startsWith('./frontend/') && !filePath.startsWith('./resource/')) {
        filePath = './frontend' + req.url;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1><p>File: ' + filePath + '</p>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Proxy function to forward API requests to backend
function proxyToBackend(req, res) {
    const options = {
        hostname: 'localhost',
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        console.error('Proxy error:', error.message);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Backend server not running. Please start it with: npm start (in another terminal)'
        }));
    });

    req.pipe(proxyReq);
}

server.listen(PORT, () => {
    console.log('🧪 Visual Test Server Running');
    console.log(`📱 Open: http://localhost:${PORT}`);
    console.log(`📝 Testing: http://localhost:${PORT}/frontend/test.html`);
    console.log(`\nPress Ctrl+C to stop`);
});
