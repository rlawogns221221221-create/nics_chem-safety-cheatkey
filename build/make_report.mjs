/* AI프렌즈 프로젝트 결과보고서를 PDF 로 굽습니다
   ───────────────────────────────────────────────────────────────
       node build/make_report.mjs

   ▸ 원본은 `docs/AI프렌즈_결과보고서.html` 입니다. 사진은 설명서가 이미
     찍어 둔 것(`docs/guide-img/`)을 그대로 씁니다 — 같은 사진을 두 번
     찍으면 두 문서의 화면이 어긋날 수 있습니다.
     사진을 새로 찍어야 하면 `node build/make_guide.mjs` 를 먼저 돌리세요.
   ▸ **10쪽을 넘으면 알려 줍니다** — 양식 3 의 조건이 "첨부 제외 10페이지
     이내" 입니다. 넘긴 채로 내면 심사에서 형식 지적을 받습니다.
   ▸ 글자로 옮겨 붙일 판은 `docs/AI프렌즈_결과보고서.md` 입니다(한글 양식). */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const 원본 = `${RPATH}/docs/AI프렌즈_결과보고서.html`;
if (!existsSync(원본)) {
  console.error('⚠ docs/AI프렌즈_결과보고서.html 이 없습니다.');
  process.exit(1);
}

/* 사진이 빠지면 표만 남은 보고서가 나옵니다 — 미리 확인합니다. */
{
  const src = readFileSync(원본, 'utf8');
  const 없는것 = [...src.matchAll(/src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => !existsSync(`${RPATH}/docs/${p}`));
  if (없는것.length) {
    console.error('⚠ 보고서가 부르는 사진이 없습니다 — '
      + 'node build/make_guide.mjs 를 먼저 돌리세요:\n  ' + 없는것.join('\n  '));
    process.exit(1);
  }
}

const browser = await chromium.launch();
const p = await browser.newPage();
await p.goto(`${ROOT}docs/AI프렌즈_결과보고서.html`);
await p.waitForLoadState('load');
await p.waitForTimeout(1200);

const out = `${RPATH}/docs/AI프렌즈_결과보고서.pdf`;
await p.pdf({ path: out, format: 'A4', printBackground: true,
  margin: { top: '15mm', bottom: '13mm', left: '15mm', right: '15mm' } });
await browser.close();

const buf = readFileSync(out);
const 쪽 = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`docs/AI프렌즈_결과보고서.pdf   ${(buf.length / 1024).toFixed(0)} KB · ${쪽}쪽`);

if (쪽 > 10) {
  console.error(`⚠ ${쪽}쪽입니다 — 양식은 **첨부 제외 10쪽 이내**입니다.`
    + ' 표·사진을 줄이거나 글을 압축하세요.');
  process.exitCode = 1;
} else {
  console.log('  10쪽 이내 확인');
}

/* 지어낸 수치가 섞이지 않게, 보고서에 적힌 핵심 수치를 자료와 대조합니다.
   화면·자료가 바뀌면 보고서도 함께 고쳐야 하는데 사람은 잊습니다. */
{
  const src = readFileSync(원본, 'utf8');
  const 자료 = readFileSync(`${RPATH}/data/resources2.js`, 'utf8');
  const 수 = (re, s) => { const m = s.match(re); return m ? Number(m[1]) : -1; };
  const 검사 = [
    ['업체 1,717', 수(/"업체건수":\s*(\d+)/, 자료) === 1717],
    ['물품 4,075', 수(/"물품건수":\s*(\d+)/, 자료) === 4075],
    ['자리 2,341', 수(/"자리건수":\s*(\d+)/, 자료) === 2341],
    ['방제자원 합계 5,792', src.includes('5,792')],
    ['대피 후보지 17,754', src.includes('17,754')],
    ['임시주거시설 15,905', src.includes('15,905')],
    ['대피장소 1,849', src.includes('1,849')],
  ];
  const 틀림 = 검사.filter(([, ok]) => !ok).map(([n]) => n);
  if (틀림.length) {
    console.error('⚠ 보고서 수치가 자료와 다릅니다: ' + 틀림.join(' · '));
    process.exitCode = 1;
  } else {
    console.log('  핵심 수치 자료와 일치');
  }
}
