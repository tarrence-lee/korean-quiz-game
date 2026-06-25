// Generates a minimal valid PNG icon (solid blue background + white text)
// No external dependencies — uses only Node.js built-ins
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, bgR, bgG, bgB) {
  // Each pixel: RGBA
  const channels = 4;
  const rowSize = size * channels;

  // Build raw image data (uncompressed scanlines, each prefixed with filter byte 0)
  const raw = Buffer.alloc(size * (1 + rowSize));
  for (let y = 0; y < size; y++) {
    const base = y * (1 + rowSize);
    raw[base] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const off = base + 1 + x * channels;
      const cx = x - size / 2, cy = y - size / 2;
      const r = size * 0.42;
      const rr = size * 0.38;
      // Outer rounded rect approximation via circle corners
      const corner = size * 0.2;
      const inRect = x >= corner && x < size - corner && y >= 0 && y < size
                  || y >= corner && y < size - corner && x >= 0 && x < size
                  || (Math.hypot(x - corner, y - corner) < corner)
                  || (Math.hypot(x - (size - corner), y - corner) < corner)
                  || (Math.hypot(x - corner, y - (size - corner)) < corner)
                  || (Math.hypot(x - (size - corner), y - (size - corner)) < corner);

      if (inRect) {
        raw[off]     = bgR;
        raw[off + 1] = bgG;
        raw[off + 2] = bgB;
        raw[off + 3] = 255;
      } else {
        raw[off] = raw[off+1] = raw[off+2] = 0;
        raw[off + 3] = 0; // transparent
      }
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const crc = crc32(crcBuf);
    const crcOut = Buffer.alloc(4); crcOut.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, t, data, crcOut]);
  }

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let v = i;
        for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
        t[i] = v;
      }
      return t;
    })());
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname);
fs.writeFileSync(path.join(dir, 'icon-192.png'), createPNG(192, 59, 130, 246));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPNG(512, 59, 130, 246));
console.log('✅ icon-192.png, icon-512.png 생성 완료');
