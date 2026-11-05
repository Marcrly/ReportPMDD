// Test dymny w prawdziwej przeglądarce (Chromium przez Playwright).
// Sprawdza to, co najważniejsze: że dane się zapisują, przetrwają odświeżenie
// i utratę jednego z magazynów, oraz że eksport i kopia zapasowa działają.
//
// Uruchom:  npm run build && npx vite preview --port 4173  (w osobnym terminalu)
//           node scripts/smoke-test.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL_ = process.env.APP_URL || 'http://localhost:4173/';
const OUT = new URL('../tests/.out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const step = (msg) => console.log(`  ✓ ${msg}`);

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return page;
}

// 1. Wpis, autozapis, odświeżenie
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, locale: 'pl-PL' });
const page = await newPage(ctx);
await page.goto(URL_);
await page.getByRole('button', { name: 'Pomiń wprowadzenie' }).click();
await page.getByRole('link', { name: 'Wypełnij dzisiejszy wpis' }).click();
const first = page.locator('.item--pmdd').first();
await first.getByRole('radio', { name: '5, silnie' }).click();
await first.getByRole('button', { name: 'Zdarzenie powiązane' }).click();
await first.locator('textarea').fill('Test zdarzenia');
await page.getByRole('radio', { name: 'Średnie' }).click();
await page.getByText('Zapisano').waitFor();
step('wpis zapisuje się automatycznie');

await page.reload();
await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).waitFor();
assert.equal(await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).getAttribute('aria-checked'), 'true');
assert.equal(await page.locator('.item--pmdd').first().locator('textarea').inputValue(), 'Test zdarzenia');
step('wpis jest po odświeżeniu strony');

// 2. Utrata kopii lustrzanej, potem utrata IndexedDB: dane wracają z drugiego magazynu
await page.evaluate(() =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith('rp1.entry.'))
    .forEach((k) => localStorage.removeItem(k)),
);
await page.reload();
await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).waitFor();
assert.equal(await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).getAttribute('aria-checked'), 'true');
const mirrored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rp1.entry.')).length);
assert.ok(mirrored >= 1, 'kopia lustrzana odtworzona');
step('po wyczyszczeniu kopii lustrzanej dane są z IndexedDB, a kopia odtwarza się sama');

await page.evaluate(
  () =>
    new Promise((res) => {
      const r = indexedDB.open('reportpmdd', 1);
      r.onsuccess = () => {
        const tx = r.result.transaction('entries', 'readwrite');
        tx.objectStore('entries').clear();
        tx.oncomplete = () => {
          r.result.close();
          res();
        };
      };
    }),
);
await page.reload();
await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).waitFor();
assert.equal(await page.locator('.item--pmdd').first().getByRole('radio', { name: '5, silnie' }).getAttribute('aria-checked'), 'true');
step('po wyczyszczeniu IndexedDB dane wracają z kopii lustrzanej');

// 3. Eksport do Excela
await page.getByRole('button', { name: 'Gotowe' }).click();
await page.getByRole('link', { name: 'Dane' }).click();
const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Pobierz plik Excel' }).click()]);
const xlsxPath = `${OUT}smoke-export.xlsx`;
await xlsx.saveAs(xlsxPath);
const head = readFileSync(xlsxPath).subarray(0, 2).toString('latin1');
assert.equal(head, 'PK', 'plik xlsx to archiwum zip');
step(`eksport Excel: ${xlsx.suggestedFilename()}`);

// 4. Kopia zapasowa i przywrócenie w "nowym telefonie"
const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Zrób kopię' }).click()]);
const bkPath = `${OUT}smoke-backup.json`;
await bk.saveAs(bkPath);
const backup = JSON.parse(readFileSync(bkPath, 'utf8'));
assert.equal(backup.app, 'ReportPMDD');
assert.ok(backup.entries.length >= 1);
step(`kopia zapasowa: ${bk.suggestedFilename()} (${backup.entries.length} dni)`);

const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pl-PL' });
const fresh = await newPage(ctx2);
await fresh.goto(URL_);
await fresh.getByRole('button', { name: 'Pomiń wprowadzenie' }).click();
await fresh.getByRole('link', { name: 'Dane' }).click();
const [chooser] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Przywróć z kopii' }).click()]);
await chooser.setFiles(bkPath);
await fresh.getByText(/Przywrócono kopię/).waitFor();
await fresh.getByRole('link', { name: 'Kalendarz' }).click();
await fresh.getByText('Wpis zapisany').waitFor();
step('przywrócenie kopii na czystym urządzeniu');

// 5. Działanie bez internetu (po zainstalowaniu service workera)
await page.goto(URL_);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await ctx.setOffline(true);
await page.reload();
await page.locator('.today-card').waitFor();
await ctx.setOffline(false);
step('aplikacja otwiera się bez internetu');

await browser.close();
if (errors.length) {
  console.error('Błędy w konsoli:', errors);
  process.exit(1);
}
console.log('Wszystko działa.');
