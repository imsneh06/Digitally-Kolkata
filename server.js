/* ==========================================================================
   DIGITALLY KOLKATA - ZERO-DEPENDENCY LOCAL SERVER & API RUNNER
   Serves static assets and runs /api/* serverless functions locally.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API Route Handling: /api/<endpoint>
  if (pathname.startsWith('/api/')) {
    const endpoint = pathname.replace(/^\/api\//, '').split('/')[0].split('?')[0];
    const apiFile = path.join(__dirname, 'api', `${endpoint}.js`);

    if (fs.existsSync(apiFile)) {
      try {
        delete require.cache[require.resolve(apiFile)];
        const handler = require(apiFile);

        // Attach query params
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        // Attach Express/Vercel-like helpers to res
        res.status = function (statusCode) {
          res.statusCode = statusCode;
          return res;
        };
        res.json = function (data) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };

        return await handler(req, res);
      } catch (err) {
        console.error(`Error in /api/${endpoint}:`, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: `API route /api/${endpoint} not found` }));
    }
  }

  // 2. Static File Handling
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // If path is a directory, check for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Clean URLs support: try appending .html if not found
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 Not Found</h1><p>The requested file was not found on Digitally Kolkata server.</p>');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚡ Digitally Kolkata Server live at http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel live at http://localhost:${PORT}/admin`);
  console.log(`📡 APIs active: /api/leads, /api/pricing, /api/agency, /api/portfolio, /api/auth, /api/sync`);
  console.log(`====================================================`);
});
