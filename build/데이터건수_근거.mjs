/* 데이터 건수 산정 근거 표를 PDF 로 굽는다
   ───────────────────────────────────────────────────────────────
       python3 build/원자료_건수.py      ← 표(HTML)를 먼저 만듭니다
       node    build/데이터건수_근거.mjs

   `docs/데이터건수_근거.html` → `docs/방제자원_원자료_데이터건수_근거.pdf`

   보고서에 붙이는 한 장이라 **A4 한 쪽을 넘기면 알려 줍니다** — 표 끝의
   한두 줄이 둘째 쪽으로 넘어가면 합계 줄이 따로 떨어져 읽기 어렵습니다. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const 이름 = 'docs/방제자원_원자료_데이터건수_근거.pdf';

const browser = await chromium.launch();
const p = await (await browser.newContext()).newPage();
const 오류 = [];
p.on('pageerror', (e) => 오류.push(String(e)));
await p.goto(`${ROOT}docs/데이터건수_근거.html`);
await p.waitForLoadState('load');
await p.evaluate(() => document.fonts.ready);

await p.pdf({ path: `${RPATH}/${이름}`, format: 'A4', printBackground: true,
  margin: { top: '10mm', bottom: '9mm', left: '10mm', right: '10mm' } });
await browser.close();

const buf = readFileSync(`${RPATH}/${이름}`);
console.log(`${이름}   ${(buf.length / 1024).toFixed(0)} KB`);
if (오류.length) console.error('⚠ 페이지 오류:', 오류);
const 쪽 = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (쪽 > 1) {
  console.error(`⚠ ${쪽}쪽이 되었습니다 — build/원자료_건수.py 의 표 글자·여백을 줄이세요.`);
  process.exitCode = 1;
} else console.log('  한 쪽 확인');
