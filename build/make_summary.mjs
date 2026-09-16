/* 성과요약서(참고 1)·이미지 양식(참고 2)을 PDF 로 굽습니다
   ───────────────────────────────────────────────────────────────
       node build/make_summary.mjs

   ▸ 원본은 `docs/성과요약서.html` · `docs/이미지양식.html` 입니다.
   ▸ **성과요약서가 한 쪽을 넘기면 멈춥니다** — 주최 측 양식이
     "성과요약서(1page)" 라고 못 박았습니다. 넘긴 채로 내면 형식 지적을
     받습니다.
   ▸ 사진은 `docs/성과이미지/` 를 씁니다(`node build/make_shots.mjs`).
     한 장이라도 없으면 그림 빠진 문서가 나오므로 먼저 확인합니다. */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const 낼것 = [
  { 원본: '성과요약서', 낼이름: '화학안전치트키_성과요약서', 쪽한계: 1 },
  { 원본: '이미지양식', 낼이름: '화학안전치트키_이미지', 쪽한계: 0 },
];

/* 부르는 사진이 다 있는지 먼저 봅니다 — 없으면 표만 남은 문서가 나옵니다 */
for (const it of 낼것) {
  const src = readFileSync(`${RPATH}/docs/${it.원본}.html`, 'utf8');
  const 없는것 = [...src.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => !existsSync(`${RPATH}/docs/${decodeURIComponent(p)}`));
  if (없는것.length) {
    console.error('⚠ 부르는 사진이 없습니다 — node build/make_shots.mjs 를 먼저'
      + ' 돌리세요:\n  ' + 없는것.join('\n  '));
    process.exit(1);
  }
}

const browser = await chromium.launch();
for (const it of 낼것) {
  const p = await browser.newPage();
  await p.goto(`${ROOT}docs/${encodeURIComponent(it.원본)}.html`);
  await p.waitForLoadState('load');
  await p.waitForTimeout(1200);
  const out = `${RPATH}/docs/${it.낼이름}.pdf`;
  await p.pdf({ path: out, format: 'A4', printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '13mm', right: '13mm' } });
  await p.close();

  const buf = readFileSync(out);
  const 쪽 = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`docs/${it.낼이름}.pdf   ${(buf.length / 1024).toFixed(0)} KB · ${쪽}쪽`);
  if (it.쪽한계 && 쪽 > it.쪽한계) {
    console.error(`⚠ ${쪽}쪽입니다 — 양식은 **${it.쪽한계}쪽**입니다.`
      + ' 줄을 줄이거나 글자를 조이세요.');
    process.exitCode = 1;
  } else if (it.쪽한계) {
    console.log(`  ${it.쪽한계}쪽 확인`);
  }
}
await browser.close();
