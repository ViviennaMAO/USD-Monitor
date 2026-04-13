/**
 * USD Monitor API Server
 * Serves pipeline output JSON files to the mini-program.
 *
 * Usage:
 *   node server/app.js              # default port 3900
 *   PORT=8080 node server/app.js    # custom port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3900;
const OUTPUT_DIR = path.resolve(__dirname, '../../usd-dashboard/pipeline/output');

const server = http.createServer((req, res) => {
  // CORS — allow mini-program devtools
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Route: GET /output/<name>.json
  const match = req.url.match(/^\/output\/(.+\.json)$/);
  if (req.method === 'GET' && match) {
    const filename = path.basename(match[1]); // prevent path traversal
    const filePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `${filename} not found` }));
    }

    const data = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    });
    return res.end(data);
  }

  // Route: GET /health
  if (req.url === '/health') {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      output_dir: OUTPUT_DIR,
      files: files.length,
      list: files
    }));
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', hint: 'GET /output/<name>.json or /health' }));
});

server.listen(PORT, () => {
  console.log(`[USD Monitor API] http://localhost:${PORT}`);
  console.log(`[USD Monitor API] Serving ${OUTPUT_DIR}`);
  console.log(`[USD Monitor API] Example: http://localhost:${PORT}/output/inference_summary.json`);
});
