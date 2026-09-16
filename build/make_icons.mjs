/* 바탕화면 아이콘 굽기 — build/icon.svg → assets/img/icon-*.png + 탭 아이콘
   ───────────────────────────────────────────────────────────────
       node build/make_icons.mjs

   ── 탭 아이콘도 여기서 만듭니다 ─────────────────────────────────
   화면의 `<link rel="icon" href="data:image/svg+xml,…">` 는 **그림이 주소
   안에 통째로 적혀 있어** icon.svg 를 보지 않습니다. 예전에는 아이콘을
   바꿀 때마다 다섯 HTML 에 손으로 옮겨 적어야 했고, 하나라도 빠뜨리면
   그 화면만 옛 아이콘이 남았습니다. 이제 icon.svg 에서 모양을 뽑아
   **한 줄로 만들어 넣습니다** — 고치는 곳이 한 곳입니다.
     · 바탕은 그라데이션 대신 **두 끝 색의 중간 한 가지**입니다. 16px 로
       줄면 어차피 구분되지 않고, 한 가지 색이면 원·점·사선을 마스크 없이
       그대로 덮어 그릴 수 있어 주소가 짧아집니다.
     · 그래서 방패 밖으로 삐져나가는 사선도 문제가 없습니다 — 바탕과
       같은 색이라 보이지 않습니다.

   ── 왜 PNG 로 굽는가 ────────────────────────────────────────────
   아이폰의 "홈 화면에 추가"(apple-touch-icon)는 **SVG 를 읽지 않습니다.**
   안드로이드 매니페스트도 SVG 지원이 기기마다 들쭉날쭉합니다. 그래서
   원본은 SVG 한 장으로 두되 실제로 쓰는 것은 PNG 로 미리 구워 둡니다.

   ── 왜 Pillow 가 아니라 브라우저인가 ────────────────────────────
   Pillow 는 SVG 를 못 읽습니다(래스터 전용). 이 저장소는 검증에 이미
   Chromium 을 쓰고 있으므로, 새 도구를 들이지 않고 그것으로 그립니다.

   ── 크기를 이렇게 잡은 이유 ─────────────────────────────────────
     192  안드로이드 홈 화면 (매니페스트 최소 요구)
     512  설치 화면·스플래시 (매니페스트 최소 요구)
     180  아이폰 홈 화면 (apple-touch-icon 표준 크기)
   더 잘게 나눠 굽지 않습니다 — 브라우저가 알아서 줄여 씁니다. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const SVG = readFileSync(`${RPATH}/build/icon.svg`, 'utf8');
const SIZES = [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'icon-180.png'],
];

/* ── 탭 아이콘 만들어 넣기 ─────────────────────────────────────── */
const 찾기 = (re, 무엇) => {
  const m = SVG.match(re);
  if (!m) { console.error(`⚠ icon.svg 에서 ${무엇} 을 못 찾았습니다`); process.exit(1); }
  return m;
};

/* 그라데이션 두 끝의 가운데 색 — 탭 아이콘의 한 가지 바탕색입니다 */
const 끝색 = [...SVG.matchAll(/stop-color="#([0-9a-f]{6})"/g)].map((m) => m[1]);
if (끝색.length < 2) { console.error('⚠ icon.svg 의 바탕 그라데이션을 못 찾았습니다'); process.exit(1); }
const 섞기 = (a, b) => '#' + [0, 2, 4].map((i) =>
  Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2)
    .toString(16).padStart(2, '0')).join('');
const 바탕색 = 섞기(끝색[0], 끝색[1]);

const browser = await chromium.launch();
for (const [size, name] of SIZES) {
  /* deviceScaleFactor 를 1 로 두고 창 크기를 목표 크기로 잡습니다 —
     화면 배율이 끼면 정확히 그 픽셀이 안 나옵니다. */
  const page = await browser.newPage({ viewport: { width: size, height: size },
                                       deviceScaleFactor: 1 });
  /* 바탕을 투명으로 두면 안드로이드가 검게 채우는 기기가 있습니다.
     아이콘 자체가 어두운 사각형으로 가득 차 있으므로 문제될 일은 없지만,
     혹시 여백이 생겨도 같은 색이 되도록 body 에도 깔아 둡니다
     (icon.svg 그라데이션의 가운데 값 — 아래에서 잰 `바탕색`). */
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:${바탕색}}
      svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`);
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(`${RPATH}/assets/img/${name}`, buf);
  console.log(`  assets/img/${name}  ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
  await page.close();
}
await browser.close();
console.log('→ 아이콘을 다시 구웠습니다. manifest.webmanifest 는 이 이름들을 부릅니다.');

const 방패색 = 찾기(/fill="(#[0-9a-f]{6})" mask=/, '방패 색')[1];
const 방패 = 찾기(/<path d="(M256 92[^"]*)"/s, '방패 모양')[1].replace(/\s+/g, ' ');
const 원 = 찾기(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="none" stroke="#000" stroke-width="(\d+)"\/>/, '둘레 원');
const 점 = 찾기(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="#000"\/>/, '가운데 점');
const 사선 = [...SVG.matchAll(/<path d="(M\d+ \d+ h\d+ l\d+ -\d+ h-\d+ Z)"\/>/g)].map((m) => m[1]);
if (!사선.length) { console.error('⚠ icon.svg 에서 안전표지 사선을 못 찾았습니다'); process.exit(1); }

/* 홑따옴표로 적습니다 — href="…" 안에 그대로 들어가야 합니다.
   `#` 은 주소에서 조각 구분자라 반드시 %23 으로 적습니다. */
const ㅅ = (c) => c.replace('#', '%23');
const 탭아이콘 = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>"
  + `<rect width='512' height='512' rx='96' fill='${ㅅ(바탕색)}'/>`
  + `<path d='${방패}' fill='${ㅅ(방패색)}'/>`
  + `<circle cx='${원[1]}' cy='${원[2]}' r='${원[3]}' fill='none' stroke='${ㅅ(바탕색)}' stroke-width='${원[4]}'/>`
  + `<circle cx='${점[1]}' cy='${점[2]}' r='${점[3]}' fill='${ㅅ(바탕색)}'/>`
  + `<g fill='${ㅅ(바탕색)}'>${사선.map((d) => `<path d='${d}'/>`).join('')}</g>`
  + '</svg>';

const 넣을곳 = ['index.html', 'sms/index.html', 'map/index.html', 'res/index.html',
              'build/닫힘안내.html'];
let 바꾼수 = 0;
for (const f of 넣을곳) {
  const 길 = `${RPATH}/${f}`;
  const 글 = readFileSync(길, 'utf8');
  /* ⚠ "글이 바뀌었나" 로 판정하면 안 됩니다 — 두 번째로 돌릴 때는 이미 같은
     그림이라 바뀐 것이 없고, 그것을 "못 찾았다"로 읽어 멈춥니다(실제로 그랬음). */
  const 줄 = /<link rel="icon" href="data:image\/svg\+xml,[^"]*">/;
  if (!줄.test(글)) { console.error(`⚠ ${f} 에서 탭 아이콘 줄을 못 찾았습니다`); process.exit(1); }
  const 새글 = 글.replace(줄, `<link rel="icon" href="${탭아이콘}">`);
  if (새글 !== 글) { writeFileSync(길, 새글); 바꾼수 += 1; }
}
console.log(`→ 탭 아이콘 — ${넣을곳.length}곳 확인, ${바꾼수}곳 고쳤습니다 (바탕 ${바탕색} · 방패 ${방패색}).`);
console.log('  ⚠ dist/ 단일 파일에도 들어가므로 build_single.py 를 다시 돌리세요.');
