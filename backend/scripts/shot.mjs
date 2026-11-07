/** docs/50. look at it. a board with avatars on it is a claim until someone sees the pixels. */
import { chromium } from 'playwright';

const BASE = process.env.BOARD_URL ?? 'http://localhost:8099';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.node');
await page.waitForTimeout(2500); // their canvas rig warms up before it draws
const canvases = await page.locator('.node canvas').count();
console.log('avatar canvases painted:', canvases);
console.log('node boxes:', await page.locator('.node').count());
if (errors.length) console.log('page errors:', errors.slice(0, 3));
await page.screenshot({ path: '/tmp/board-avatars.png' });
console.log('shot: /tmp/board-avatars.png');
await browser.close();
