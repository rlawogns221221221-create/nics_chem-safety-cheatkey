/* docs/QR/QR_안내.html → 안내 한 장 PNG·PDF
     node build/make_qr_card.mjs
   먼저 python3 build/make_qr.py 를 돌려 원본 HTML 을 만드세요.
   PNG 는 카드만 잘라 굽고(문자·단체방에 바로 붙이는 용), PDF 는 A4 한 쪽
   가운데에 카드를 둡니다(붙여 두는 인쇄용). */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 원본 = path.join(ROOT, 'docs/QR/QR_안내.html');
if (!fs.existsSync(원본)) { console.error('먼저 python3 build/make_qr.py'); process.exit(1); }

const B = await chromium.launch();
const P = await B.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3 });
await P.goto('file://' + 원본);
await P.evaluate(() => document.fonts.ready);
/* 글꼴이 안 실리면 대체 글꼴로 구워져 줄 길이가 달라집니다 — 멈춥니다 */
const 글꼴 = await P.evaluate(() => document.fonts.check('700 20px "Pretendard GOV"'));
if (!글꼴) { console.error('Pretendard GOV 를 못 실었습니다'); process.exit(1); }
await (await P.$('#card')).screenshot({ path: path.join(ROOT, 'docs/QR/QR_안내.png') });
await P.pdf({ path: path.join(ROOT, 'docs/QR/QR_안내.pdf'), format: 'A4', printBackground: true });
await B.close();
console.log('  → docs/QR/QR_안내.png · QR_안내.pdf');
