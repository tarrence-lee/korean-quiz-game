// Generates PWA icons: white "?" on blue-gradient rounded background
// No external dependencies — pure Node.js (zlib + raw PNG binary)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── PNG builder ───────────────────────────────────────────────────
function buildPNG(size, drawFn) {
  const ch = 4;
  const pixels = new Uint8Array(size * size * ch);

  function sp(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const o = (y * size + x) * ch;
    pixels[o] = r; pixels[o+1] = g; pixels[o+2] = b; pixels[o+3] = (a === undefined ? 255 : a);
  }

  drawFn(pixels, size, sp);

  const raw = Buffer.alloc(size * (1 + size * ch));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * ch)] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * ch;
      const d = y * (1 + size * ch) + 1 + x * ch;
      raw[d] = pixels[s]; raw[d+1] = pixels[s+1]; raw[d+2] = pixels[s+2]; raw[d+3] = pixels[s+3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
      t[i] = v;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, cr]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Point-to-segment distance ─────────────────────────────────────
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++)
    d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]));
  return d;
}

// ── Icon drawing (192px coordinate space, scaled by f) ───────────
function drawIcon(pixels, size, sp) {
  const f = size / 192;
  const cx = size / 2;

  // ── Background: radial-gradient blue rounded rectangle ──
  const corner = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTL = Math.hypot(x - corner, y - corner) < corner;
      const inTR = Math.hypot(x - (size - corner), y - corner) < corner;
      const inBL = Math.hypot(x - corner, y - (size - corner)) < corner;
      const inBR = Math.hypot(x - (size - corner), y - (size - corner)) < corner;
      const inEdge = (x >= corner && x < size - corner) || (y >= corner && y < size - corner);
      if (!(inEdge || inTL || inTR || inBL || inBR)) continue;

      // Radial gradient: center #4F94F8 → edge #1D4ED8
      const t = Math.min(1, Math.hypot(x - cx, y - cx) / (size * 0.62));
      sp(x, y,
        Math.round(79  + (29  - 79)  * t),   // R: #4F → #1D
        Math.round(148 + (78  - 148) * t),   // G: #94 → #4E
        Math.round(248 + (216 - 248) * t)    // B: #F8 → #D8
      );
    }
  }

  // ── White "?" via stroke-path rendering ────────────────
  // Coordinates in 192px space; distances compared in that space too.
  const SW = 7.2;      // stroke half-width → 14.4px line thickness
  const DOT_R = 10.5;  // dot radius

  // Top arc of "?": 270° arc, center (96, 63), radius 27
  // From 120° (lower-left) → 390°=30° (lower-right), going up-left-over-top-down
  const ARC_CX = 96, ARC_CY = 63, ARC_R = 27;
  const arcPts = [];
  for (let i = 0; i <= 48; i++) {
    const rad = (120 + (i / 48) * 270) * Math.PI / 180;
    arcPts.push([ARC_CX + ARC_R * Math.cos(rad), ARC_CY + ARC_R * Math.sin(rad)]);
  }

  // Hook: connects arc's lower-right end to the stem
  const hookPts = [
    [ARC_CX + ARC_R * Math.cos(30 * Math.PI / 180), ARC_CY + ARC_R * Math.sin(30 * Math.PI / 180)],
    [117, 88],
    [109, 100],
    [ 96, 110],
    [ 96, 122],
  ];

  // Dot position
  const DOT_CX = 96, DOT_CY = 141;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / f;
      const py = (y + 0.5) / f;
      const dArc  = polyDist(px, py, arcPts);
      const dHook = polyDist(px, py, hookPts);
      const dDot  = Math.hypot(px - DOT_CX, py - DOT_CY);
      if (Math.min(dArc, dHook) <= SW || dDot <= DOT_R) {
        sp(x, y, 255, 255, 255);
      }
    }
  }
}

// ── Generate both sizes ───────────────────────────────────────────
const dir = __dirname;
[192, 512].forEach(size => {
  const buf = buildPNG(size, drawIcon);
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png 생성`);
});
console.log('완료');
