/**
 * docs/49. the drag, in a browser. reasoned-about pointer code is not the same as observed.
 *
 * needs playwright installed on the box (not a dependency of this repo):
 *   npm i -D playwright && npx playwright install --with-deps chromium
 *   node scripts/drag-check.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BOARD_URL ?? 'http://localhost:8099';
const node = (b, id) => b.nodes.find((n) => n.id === id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'warning') console.log('  page says:', m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.node');

const before = await page.evaluate(() => fetch('/api/board').then((r) => r.json()));
console.log('before:', node(before, 'dept.code'), node(before, 'seat.code'));

const el = page.locator('.node[data-id="dept.code"]');
const box = await el.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
// six small steps, so the grid snap has intermediate positions to round
for (let i = 1; i <= 6; i += 1) await page.mouse.move(box.x + box.width / 2 + i * 20, box.y + box.height / 2 + i * 5);
await page.mouse.up();
await page.waitForTimeout(900);

const after = await page.evaluate(() => fetch('/api/board').then((r) => r.json()));
console.log('after: ', node(after, 'dept.code'), node(after, 'seat.code'));
console.log('branch followed:', node(after, 'seat.code').x === node(after, 'dept.code').x);
console.log('snapped:', node(after, 'dept.code').x % 20 === 0 && node(after, 'dept.code').y % 20 === 0);

// now a drop onto an occupied square, which must bounce
const target = node(after, 'dept.accounting');
const el2 = page.locator('.node[data-id="dept.code"]');
const b2 = await el2.boundingBox();
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
await page.mouse.down();
await page.mouse.move(b2.x + b2.width / 2 + (target.x - node(after, 'dept.code').x), b2.y + b2.height / 2 + (target.y - node(after, 'dept.code').y));
await page.mouse.up();
await page.waitForTimeout(900);
const final = await page.evaluate(() => fetch('/api/board').then((r) => r.json()));
console.log('after refused drop:', node(final, 'dept.code'), 'unmoved:', node(final, 'dept.code').x === node(after, 'dept.code').x);

await page.screenshot({ path: '/tmp/board.png', fullPage: false });
console.log('screenshot: /tmp/board.png');
await browser.close();
