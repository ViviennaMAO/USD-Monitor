/**
 * Generate minimalist tabBar PNG icons (81×81, RGBA)
 * No external dependencies — uses only Node.js built-in zlib
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZE = 81;
const DIR = path.join(__dirname, 'static', 'images');

// ── CRC32 ──────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG builder ────────────────────────────────────────
function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tp = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tp, data])));
  return Buffer.concat([len, tp, data, crc]);
}

function buildPNG(w, h, pixels) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', zlib.deflateSync(raw)), makeChunk('IEND', Buffer.alloc(0))]);
}

// ── Drawing helpers ────────────────────────────────────
function setPixel(buf, w, x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const i = (y * w + x) * 4;
  // Alpha blend
  const srcA = a / 255;
  const dstA = buf[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    buf[i]     = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA);
    buf[i + 1] = Math.round((g * srcA + buf[i+1] * dstA * (1 - srcA)) / outA);
    buf[i + 2] = Math.round((b * srcA + buf[i+2] * dstA * (1 - srcA)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  }
}

function drawLine(buf, w, x0, y0, x1, y1, r, g, b, thick = 3) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let t = 0; t <= len; t++) {
    const px = x0 + dx * t / len;
    const py = y0 + dy * t / len;
    for (let ox = -thick/2; ox <= thick/2; ox++)
      for (let oy = -thick/2; oy <= thick/2; oy++)
        if (ox*ox + oy*oy <= thick*thick/4)
          setPixel(buf, w, px+ox, py+oy, r, g, b);
  }
}

function drawCircle(buf, w, cx, cy, radius, r, g, b, fill = false, thick = 3) {
  for (let y = -radius - 2; y <= radius + 2; y++) {
    for (let x = -radius - 2; x <= radius + 2; x++) {
      const dist = Math.sqrt(x * x + y * y);
      if (fill) {
        if (dist <= radius) setPixel(buf, w, cx + x, cy + y, r, g, b);
      } else {
        if (Math.abs(dist - radius) <= thick / 2) setPixel(buf, w, cx + x, cy + y, r, g, b);
      }
    }
  }
}

function drawRect(buf, w, x, y, rw, rh, r, g, b, fill = true) {
  for (let dy = 0; dy < rh; dy++)
    for (let dx = 0; dx < rw; dx++)
      setPixel(buf, w, x + dx, y + dy, r, g, b);
}

function drawArc(buf, w, cx, cy, radius, startAngle, endAngle, r, g, b, thick = 3) {
  const steps = Math.max(100, Math.ceil(radius * Math.abs(endAngle - startAngle)));
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * i / steps;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    for (let ox = -thick/2; ox <= thick/2; ox++)
      for (let oy = -thick/2; oy <= thick/2; oy++)
        if (ox*ox + oy*oy <= thick*thick/4)
          setPixel(buf, w, px+ox, py+oy, r, g, b);
  }
}

// ── Icon drawers ───────────────────────────────────────
function drawHome(buf, w, cr, cg, cb) {
  const cx = 40, cy = 40;
  // Roof (triangle)
  drawLine(buf, w, cx, 16, 18, 40, cr, cg, cb, 3.5);
  drawLine(buf, w, cx, 16, 62, 40, cr, cg, cb, 3.5);
  // Walls
  drawLine(buf, w, 22, 38, 22, 64, cr, cg, cb, 3.5);
  drawLine(buf, w, 58, 38, 58, 64, cr, cg, cb, 3.5);
  // Floor
  drawLine(buf, w, 22, 64, 58, 64, cr, cg, cb, 3.5);
  // Door
  drawRect(buf, w, 34, 48, 12, 16, cr, cg, cb, false);
  drawLine(buf, w, 34, 48, 34, 64, cr, cg, cb, 2);
  drawLine(buf, w, 46, 48, 46, 64, cr, cg, cb, 2);
  drawLine(buf, w, 34, 48, 46, 48, cr, cg, cb, 2);
}

function drawChart(buf, w, cr, cg, cb) {
  // 3 bars rising
  const barW = 12, gap = 6, baseY = 64, startX = 16;
  const heights = [22, 34, 46];
  heights.forEach((h, i) => {
    const x = startX + i * (barW + gap);
    // Rounded top bar
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < barW; dx++)
        setPixel(buf, w, x + dx, baseY - dy, cr, cg, cb);
  });
  // Trend line
  drawLine(buf, w, 20, 50, 40, 34, cr, cg, cb, 2.5);
  drawLine(buf, w, 40, 34, 62, 18, cr, cg, cb, 2.5);
  // Dot at end
  drawCircle(buf, w, 62, 18, 3, cr, cg, cb, true);
}

function drawSignal(buf, w, cr, cg, cb) {
  const cx = 40, cy = 44;
  // Center dot
  drawCircle(buf, w, cx, cy, 4, cr, cg, cb, true);
  // Concentric arcs (top half)
  drawArc(buf, w, cx, cy, 16, -Math.PI * 0.8, -Math.PI * 0.2, cr, cg, cb, 3);
  drawArc(buf, w, cx, cy, 28, -Math.PI * 0.8, -Math.PI * 0.2, cr, cg, cb, 3);
  drawArc(buf, w, cx, cy, 16, Math.PI * 0.2, Math.PI * 0.8, cr, cg, cb, 3);
  drawArc(buf, w, cx, cy, 28, Math.PI * 0.2, Math.PI * 0.8, cr, cg, cb, 3);
}

function drawMore(buf, w, cr, cg, cb) {
  const cy = 40;
  // Three horizontal dots
  drawCircle(buf, w, 20, cy, 5, cr, cg, cb, true);
  drawCircle(buf, w, 40, cy, 5, cr, cg, cb, true);
  drawCircle(buf, w, 60, cy, 5, cr, cg, cb, true);
}

// ── Generate all icons ─────────────────────────────────
const GRAY = [100, 116, 139];   // #64748b
const CYAN = [56, 189, 248];    // #38bdf8

const icons = [
  { name: 'tab-home', draw: drawHome },
  { name: 'tab-chart', draw: drawChart },
  { name: 'tab-signal', draw: drawSignal },
  { name: 'tab-more', draw: drawMore },
];

fs.mkdirSync(DIR, { recursive: true });

icons.forEach(({ name, draw }) => {
  // Normal (gray)
  let px = Buffer.alloc(SIZE * SIZE * 4, 0);
  draw(px, SIZE, ...GRAY);
  fs.writeFileSync(path.join(DIR, `${name}.png`), buildPNG(SIZE, SIZE, px));

  // Active (cyan)
  px = Buffer.alloc(SIZE * SIZE * 4, 0);
  draw(px, SIZE, ...CYAN);
  fs.writeFileSync(path.join(DIR, `${name}-active.png`), buildPNG(SIZE, SIZE, px));
});

console.log('Generated 8 tabBar icons in', DIR);
