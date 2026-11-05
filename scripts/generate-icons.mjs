// Generuje ikony PWA (PNG) z jednego rysunku SVG.
// Uruchom: npm run icons  (wymaga Playwright z przeglądarką Chromium)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SAGE = '#465c3f';
const SAGE_DARK = '#3b4f35';
const BEIGE = '#f3ede2';
const LEAF_LIGHT = '#cbd7bf';
const ROSE = '#dda89d';
const HONEY = '#c79a3c';

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
}
function tangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const d = [0, 1].map((k) => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]));
  return (Math.atan2(d[1], d[0]) * 180) / Math.PI;
}

/** Gałązka z liśćmi w polu 512x512, skalowana do "safe zone". */
function art(scale) {
  const LEAF = 'M0 0 C 22 -27, 70 -31, 100 0 C 70 31, 22 27, 0 0 Z';
  const p0 = [150, 400];
  const p1 = [190, 330];
  const p2 = [250, 200];
  const p3 = [372, 118];
  const n = 7;
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (i * 0.78) / (n - 1);
    const [x, y] = bezier(p0, p1, p2, p3, t);
    const a = tangent(p0, p1, p2, p3, t) + (i % 2 ? 50 : -50);
    const s = 1.1 - t * 0.5;
    const fill = i % 3 === 1 ? LEAF_LIGHT : BEIGE;
    leaves.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${s.toFixed(3)})"><path d="${LEAF}" fill="${fill}"/><path d="M6 0 L 82 0" stroke="${SAGE}" stroke-width="3.2" stroke-linecap="round" opacity="0.45"/></g>`,
    );
  }
  const tip = tangent(p0, p1, p2, p3, 1);
  const petals = [0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-17" rx="11" ry="17" fill="${ROSE}" transform="rotate(${r})"/>`).join('');
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M${p0} C ${p1} ${p2} ${p3}" fill="none" stroke="${BEIGE}" stroke-width="7" stroke-linecap="round"/>
    <path d="M193 322 Q 166 262 176 196" fill="none" stroke="${BEIGE}" stroke-width="5" stroke-linecap="round"/>
    ${leaves.join('')}
    <g transform="translate(${p3[0]} ${p3[1]}) rotate(${tip}) scale(0.7)"><path d="${LEAF}" fill="${BEIGE}"/></g>
    <g transform="translate(176 172)">${petals}<circle r="9" fill="${HONEY}"/></g>
  </g>`;
}

function svg({ scale, rounded }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#557050"/><stop offset="1" stop-color="${SAGE_DARK}"/></radialGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#g)"/>
  ${art(scale)}
</svg>`;
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const targets = [
  { file: 'pwa-512.png', size: 512, scale: 0.92, rounded: false },
  { file: 'pwa-192.png', size: 192, scale: 0.92, rounded: false },
  { file: 'maskable-512.png', size: 512, scale: 0.72, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86, rounded: false },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${SAGE}">${svg(t).replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)}</body></html>`,
  );
  await page.screenshot({ path: new URL(t.file, out).pathname, omitBackground: false });
  console.log('zapisano', t.file);
}
writeFileSync(new URL('icon-source.svg', out), svg({ scale: 0.92, rounded: true }));
await browser.close();
