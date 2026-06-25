const fs = require('fs');
const path = require('path');

const svg = (size) => [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
  `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#3b82f6"/>`,
  `<rect x="${size*0.12}" y="${size*0.12}" width="${size*0.76}" height="${size*0.76}" rx="${Math.round(size*0.14)}" fill="#2563eb"/>`,
  `<text x="${size/2}" y="${Math.round(size*0.67)}" font-size="${Math.round(size*0.48)}"`,
  ` text-anchor="middle" dominant-baseline="auto"`,
  ` font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">&#x1F9E0;</text>`,
  `</svg>`
].join('\n');

const dir = path.join(__dirname);
fs.writeFileSync(path.join(dir, 'icon-192.svg'), svg(192), 'utf-8');
fs.writeFileSync(path.join(dir, 'icon-512.svg'), svg(512), 'utf-8');
console.log('SVG 아이콘 생성 완료');
