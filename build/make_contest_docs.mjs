/* 공모전 제출 서류 굽기 — 구동안내서 · 참가신청서 (PDF)
   ───────────────────────────────────────────────────────────────
       node build/make_contest_docs.mjs

   원본   docs/공모전/구동안내서.html · docs/공모전/참가신청서.html
   값     docs/공모전/참가정보.json        (기관명·팀명·GitLab 주소 — 저장소에 있음)
          docs/공모전/참가정보.local.json  (성명·연락처·이메일 — **저장소 제외**)
   결과   docs/공모전/[구동안내서]_기관명_팀명.pdf
          docs/공모전/[참가신청서]_기관명_팀명.pdf   ← 개인정보가 들어가 저장소 제외

   ── 왜 이렇게 했나 ─────────────────────────────────────────────
   · 파일 이름 규칙이 대회 안내서에 정해져 있습니다 —
     "[구동안내서]_기관명_팀명(개인은 성명).pdf". 손으로 이름을 바꾸다 틀리면
     규격 미준수로 심사에서 빠질 수 있어 스크립트가 붙입니다.
   · 구동안내서는 **A4 3~5쪽**이 규격입니다. 넘치거나 모자라면 멈춥니다.
   · 참가신청서에는 성명·휴대전화·이메일이 들어갑니다. 저장소에 개인정보를
     넣지 않는다는 원칙(CLAUDE.md 2절 4항) 그대로, 그 값은 저장소 밖 파일에서만
     읽고 결과 PDF 도 .gitignore 로 막습니다.
   · 아직 정하지 않은 값(팀명 등)은 **【입력 필요: ○○】** 로 붉게 남깁니다 —
     빈칸으로 두면 빠진 줄 모르고 낼 수 있습니다. 하나라도 남으면 끝에 알립니다. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const DIR = `${RPATH}/docs/공모전`;

const 값 = JSON.parse(readFileSync(`${DIR}/참가정보.json`, 'utf8'));
if (existsSync(`${DIR}/참가정보.local.json`)) {
  Object.assign(값, JSON.parse(readFileSync(`${DIR}/참가정보.local.json`, 'utf8')));
}
/* 참가신청서의 표 줄·서명 줄처럼 HTML 조각으로 들어가는 값.
   개인정보 칸은 비어 있으면 **빈칸 그대로** 둡니다(손으로 적을 수 있게) —
   【입력 필요】 는 저장소에 있는 값(팀명·GitLab 등)에만 붙입니다. */
const 막기 = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const 팀원 = Array.isArray(값.팀원) && 값.팀원.length ? 값.팀원
  : [{ 역할: '팀장' }, { 역할: '팀원' }];
const 날것 = {
  팀원줄: 팀원.map((m, i) => `<tr><td>팀원${i + 1}${i === 0 ? '<br>(접수대표)' : ''}</td>`
    + ['성명', '부서', '직급', '직위', '연락처', '이메일', '역할'].map((k) => `<td>${막기(m[k])}</td>`).join('')
    + '</tr>').join(''),
  서명줄: 팀원.map((m) => `참가자 &nbsp;성명 &nbsp;<b>${막기(m.성명) || '&nbsp;'.repeat(16)}</b> &nbsp;(서명)`).join('<br>'),
  동의표: 값.동의 === true ? '✓' : '',
  월: 막기(값.월 || '') || '&nbsp;&nbsp;&nbsp;', 일: 막기(값.일 || '') || '&nbsp;&nbsp;&nbsp;',
};
const 빠진것 = new Set();
const 채우기 = (html) => html.replace(/\{\{([^}]+)\}\}/g, (m, k) => {
  if (k in 날것) return 날것[k];
  const v = 값[k];
  if (v == null || String(v).trim() === '') {
    빠진것.add(k);
    return `<span style="color:#c4271d;font-weight:700">【입력 필요: ${k}】</span>`;
  }
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
});
const 이름표 = `${값.기관명 || '기관명'}_${값.팀명 || '팀명'}`;

const 서류 = [
  { 원본: '구동안내서.html', 낼: `[구동안내서]_${이름표}.pdf`, 쪽: [3, 5] },
  { 원본: '참가신청서.html', 낼: `[참가신청서]_${이름표}.pdf`, 쪽: [1, 1] },
];

const browser = await chromium.launch();
const 문제 = [];
for (const d of 서류) {
  if (!existsSync(`${DIR}/${d.원본}`)) continue;
  /* 원본과 같은 폴더에 임시로 써야 그림·글꼴의 상대 경로가 맞습니다 */
  const 임시 = `${DIR}/.임시_${d.원본}`;
  writeFileSync(임시, 채우기(readFileSync(`${DIR}/${d.원본}`, 'utf8')));
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const p = await ctx.newPage();
  await p.goto('file://' + 임시);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const 그림없음 = await p.$$eval('img', (is) => is.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')));
  그림없음.forEach((s) => 문제.push(`${d.원본}: 그림을 못 읽음 ${s}`));
  await p.pdf({ path: `${DIR}/${d.낼}`, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await ctx.close();
  rmSync(임시, { force: true });
  const 쪽 = (readFileSync(`${DIR}/${d.낼}`, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`  docs/공모전/${d.낼}  ${쪽}쪽`);
  if (쪽 < d.쪽[0] || 쪽 > d.쪽[1]) 문제.push(`${d.낼}: ${쪽}쪽 — ${d.쪽[0]}~${d.쪽[1]}쪽이어야 합니다`);
}
await browser.close();

if (빠진것.size) console.log(`\n  아직 정하지 않은 값: ${[...빠진것].join(' · ')} — 서류에 【입력 필요】로 남았습니다`);
if (문제.length) {
  console.error('\n⚠ 고칠 것');
  문제.forEach((m) => console.error('  · ' + m));
  process.exitCode = 1;
}
