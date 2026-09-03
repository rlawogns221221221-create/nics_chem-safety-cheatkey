/* 발표용 한 장 보고서를 PDF 로 굽는다
   ───────────────────────────────────────────────────────────────
       node build/방제자원_보고서.mjs

   `docs/방제자원_현황보고.html` → `docs/화학사고_방제자원_취합현황.pdf`

   원페이퍼와 같은 규칙입니다 — **A4 한 쪽을 넘기면 멈춥니다.**
   발표에서 넘기는 장이 두 장이 되면 '한 장 보고'가 아니고, 두 번째 쪽에
   남은 한두 줄 때문에 인쇄물이 지저분해집니다. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const browser = await chromium.launch();
const ctx = await browser.newContext();
const p = await ctx.newPage();
const 오류 = [];
p.on('pageerror', (e) => 오류.push(String(e)));

await p.goto(`${ROOT}docs/방제자원_현황보고.html`);
await p.waitForLoadState('load');
await p.waitForTimeout(900);

const out = `${RPATH}/docs/화학사고_방제자원_취합현황.pdf`;
await p.pdf({ path: out, format: 'A4', printBackground: true,
  margin: { top: '10mm', bottom: '9mm', left: '10mm', right: '10mm' } });
await browser.close();

const buf = readFileSync(out);
console.log(`docs/화학사고_방제자원_취합현황.pdf   ${(buf.length / 1024).toFixed(0)} KB`);
if (오류.length) console.error('⚠ 페이지 오류:', 오류);

const 쪽 = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (쪽 > 1) {
  console.error(`\n⚠ 보고서가 ${쪽}쪽이 되었습니다 — 내용을 줄이거나 `
    + `docs/방제자원_현황보고.html 의 글자·여백을 줄이세요.`);
  process.exitCode = 1;
} else {
  console.log('  한 쪽 확인');
}
