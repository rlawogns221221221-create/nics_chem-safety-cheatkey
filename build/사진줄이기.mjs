/* 성과 이미지 PNG 를 **한글 파일에 넣을 크기**로 줄입니다
   ───────────────────────────────────────────────────────────────
       node build/사진줄이기.mjs

   docs/성과이미지/*.png  →  docs/성과이미지/축소/*.png

   ── 왜 줄이나 ──────────────────────────────────────────────────
   원본 5장이 9.3MB 입니다. 그대로 한글 파일에 넣으면 첨부가 10MB 가까이
   되어 기관 메일에서 걸립니다. **고화질 원본은 따로 냅니다**(양식이 그렇게
   요구합니다) — 문서 안의 그림은 A4 폭에 맞춰 어차피 줄어듭니다.

   ── 얼마나 줄이나 ──────────────────────────────────────────────
   긴 변 1,600px. 대표 이미지는 A4 폭(146mm)에 놓이므로 1,600px 이면
   278dpi 입니다 — 인쇄해도 또렷합니다. 더 줄이면 지도의 글자가 뭉갭니다.

   PNG 로 줄여도 화면 사진은 5.7MB 라 **JPEG(품질 0.93)** 으로 냅니다.
   목록 글자를 확대해 대 보고 고른 값입니다 — 더 낮추면 가는 획이 번집니다.

   ⚠ 원본(docs/성과이미지/*.png)을 덮어쓰지 않습니다. 그 파일이 주최 측에
     내는 고화질 원본입니다. */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const IN = `${RPATH}/docs/성과이미지`;
const OUT = `${IN}/축소`;
const 긴변 = 1600;

mkdirSync(OUT, { recursive: true });

const 목록 = readdirSync(IN).filter((f) => f.endsWith('.png')).sort();
if (!목록.length) {
  console.error('⚠ docs/성과이미지 에 PNG 가 없습니다 — build/make_shots.mjs 를 먼저 돌리세요.');
  process.exit(1);
}

const browser = await chromium.launch();
const p = await browser.newPage();
await p.goto('about:blank');

for (const f of 목록) {
  const b64 = readFileSync(`${IN}/${f}`).toString('base64');
  const out = await p.evaluate(async ([데이터, 긴변]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 데이터; });
    const 배 = Math.min(1, 긴변 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * 배);
    c.height = Math.round(img.height * 배);
    const g = c.getContext('2d');
    /* 화면 사진은 가는 글자가 많습니다 — 기본(저품질) 보간으로 줄이면
       목록 글씨가 뭉갭니다. 높은 품질로 잡습니다. */
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    /* JPEG 는 투명을 모릅니다 — 깔아 두지 않으면 배경이 검게 나옵니다 */
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/jpeg', 0.93), w: c.width, h: c.height };
  }, [`data:image/png;base64,${b64}`, 긴변]);

  const buf = Buffer.from(out.url.split(',')[1], 'base64');
  const 낼이름 = f.replace(/\.png$/, '.jpg');
  writeFileSync(`${OUT}/${낼이름}`, buf);
  const 전 = statSync(`${IN}/${f}`).size / 1024;
  console.log(`  ${낼이름}  ${out.w}×${out.h}px  ${전.toFixed(0)} → ${(buf.length / 1024).toFixed(0)} KB`);
}

await browser.close();
console.log(`\ndocs/성과이미지/축소/  ${목록.length}장`);
