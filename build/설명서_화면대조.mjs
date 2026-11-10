/* 설명서 ↔ 화면 대조 — 「심사위원처럼 따라 해 보기」 점검
 *
 *   node build/설명서_화면대조.mjs 문서 [문서 …] [--out 결과.md]
 *     문서: .md · .txt · .hwpx · .hwp · .pdf  (README · 구동안내서 · 설명서 무엇이든)
 *
 * ── 왜 만들었나 (2026-11-10 · 공모전 마감 전날) ───────────────────────
 * 심사위원은 GitLab README 와 구동안내서에 적힌 대로 화면을 눌러 봅니다. 글에는
 * 「상황 공유」 라고 적혀 있는데 화면 단추가 「공유하기」 라면, 그 자리에서 길을
 * 잃고 "설명과 다르다" 로 감점됩니다. 사람이 눈으로 대조하면 빠뜨리므로 기계로 합니다.
 *
 * ── 무엇을 하나 ─────────────────────────────────────────────────────
 *  ① 문서에서 **화면 낱말 후보**를 뽑습니다 — 「…」 『…』 (마크다운이면 `…` 도) 안의 글,
 *     그리고 참고용으로 "…" ‘…’ 따옴표 · **굵은 글** 안의 짧은 글.
 *  ② 휴대전화(아이폰 13)와 PC(1366×768)에서 진입 화면과 도구 넷을 **README 의
 *     「따라 해 보기」 순서대로** 끝까지 눌러 가며 화면 글자를 모읍니다
 *     — 보이는 글 · 숨은 글(메뉴 속 단추·접힌 칸·placeholder·aria-label) 따로.
 *     한 걸음이라도 막히면 「흐름 오류」 로 적습니다(그 걸음을 글대로 못 따라간다는 뜻).
 *  ③ 낱말마다 어디에 있는지 적습니다 — 화면(휴대전화/PC) · 숨은 글 · 자료(입력값) · 없음.
 *     없으면 그 낱말이 나온 문서의 줄을 함께 보여 줍니다.
 *
 * ⚠ 판정은 사람이 합니다. 「위험합니다·안전합니다」 처럼 **화면에 없어야 맞는 말**을
 *   인용한 줄도 있어, 줄에 '않·없·빼' 가 있으면 「부정 문맥」 으로 따로 둡니다.
 * ⚠ 저장소를 어디에 두어도 돕니다 — 스스로 작은 웹 서버를 띄웁니다(바깥으로 안 나감).
 */
import { chromium, devices } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const DOCS = args;
if (!DOCS.length) {
  console.error('쓰는 법: node build/설명서_화면대조.mjs 문서 [문서 …] [--out 결과.md]');
  process.exit(2);
}

/* ── ① 문서 글 읽기 ─────────────────────────────────────────────── */
function 문서글(파일) {
  const ext = path.extname(파일).toLowerCase();
  if (ext === '.hwpx' || ext === '.hwp') {
    const 글 = execFileSync('python3', [path.join(ROOT, 'build', 'hwp읽기.py'), 파일], { encoding: 'utf8', maxBuffer: 64 << 20 });
    /* hwp읽기.py 는 "   12| 문단" 꼴로 냅니다. 표 전체를 한 문단으로 이어 붙인 줄도 섞여
       있어(같은 글이 두 번) 낱말은 아래에서 겹침을 걸러 냅니다. */
    return 글.split('\n').map(l => l.replace(/^\s*\d+\|\s?/, ''));
  }
  if (ext === '.pdf') return execFileSync('pdftotext', ['-layout', 파일, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n');
  return fs.readFileSync(파일, 'utf8').split('\n');
}
const 한글 = /[가-힣]/;
function 낱말뽑기(줄들, 마크다운) {
  const 낱말 = new Map();   // 글 → {종류, 줄들[]}
  const 넣기 = (t, 종류, 줄번호, 줄) => {
    t = t.trim();
    if (!t || t.length > 60 || !한글.test(t)) return;
    const 키 = 종류 + '|' + t;
    if (!낱말.has(키)) 낱말.set(키, { 글: t, 종류, 자리: [] });
    const 기록 = 낱말.get(키);
    if (기록.자리.length < 3) 기록.자리.push({ 줄번호, 줄: 줄.trim().slice(0, 160) });
  };
  줄들.forEach((줄, i) => {
    if (줄.length > 2000) return;                     // 표 전체를 이어 붙인 줄 — 같은 글이 따로 또 나옴
    for (const m of 줄.matchAll(/「([^」]{1,60})」|『([^』]{1,60})』/g)) 넣기(m[1] || m[2], '낫표', i + 1, 줄);
    if (마크다운) {
      /* `…` 가운데 파일 이름·경로·명령은 화면 낱말이 아닙니다 — 따로 둡니다(묶음에 있는지는
         make_contest_package.py 가 봅니다) */
      for (const m of 줄.matchAll(/`([^`]{1,60})`/g))
        넣기(m[1], /\.(pdf|mp4|md|html?|js|mjs|py|sh|hwpx?|zip|csv|json|png)$|\/|^python|^node|^tests/i.test(m[1]) ? '파일' : '코드', i + 1, 줄);
      for (const m of 줄.matchAll(/\*\*([^*]{1,24})\*\*/g)) 넣기(m[1], '굵은글', i + 1, 줄);
    }
    for (const m of 줄.matchAll(/[“"]([^”"]{1,40})[”"]|‘([^’]{1,40})’/g)) 넣기(m[1] || m[2], '따옴표', i + 1, 줄);
  });
  return [...낱말.values()];
}

/* ── 맞추기 — 띄어쓰기·가운뎃점·괄호 모양 차이는 같은 것으로 ────────── */
const 고르게 = s => String(s).normalize('NFC').replace(/\s+/g, '').replace(/[·・‧∙•]/g, '·')
  .replace(/[「」『』“”"'‘’`()（）\[\]]/g, '').toLowerCase();
function 찾기(낱말, 글덩어리) {
  const n = 고르게(낱말);
  if (!n) return false;
  if (/○/.test(n)) {                                   // ○○ 은 무엇이든 — 예시 자리
    const re = new RegExp(n.split(/○+/).map(x => x.replace(/[.*+?^${}|\\]/g, '\\$&')).join('.{0,30}'));
    return re.test(글덩어리);
  }
  return 글덩어리.includes(n);
}

/* ── ② 화면 글자 모으기 ─────────────────────────────────────────── */
const 종류표 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const 서버 = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const 파일 = path.join(ROOT, p);
  if (!파일.startsWith(ROOT) || !fs.existsSync(파일) || fs.statSync(파일).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 종류표[path.extname(파일).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(파일).pipe(res);
});
await new Promise(r => 서버.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${서버.address().port}/`;

const 모음 = { '화면(휴대전화)': new Set(), '화면(PC)': new Set(), '숨은 글': new Set() };
const 흐름오류 = [];
const 쉼 = ms => new Promise(r => setTimeout(r, ms));
const 긁기 = () => {
  const 보임 = document.body.innerText;
  const 숨음 = [];
  document.querySelectorAll('button,a,label,option,summary,th,h1,h2,h3,h4,[role=tab],[role=button],legend,dt')
    .forEach(e => 숨음.push(e.textContent));
  document.querySelectorAll('[placeholder],[aria-label],[title],[alt],[data-ph-s]').forEach(e => {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt', 'data-ph-s']) if (e.getAttribute(a)) 숨음.push(e.getAttribute(a));
  });
  숨음.push(document.title);
  return { 보임, 숨음: 숨음.join('\n') };
};

async function 기기로돌기(이름, 설정) {
  const B = await chromium.launch();
  const ctx = await B.newContext({ ...설정, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    geolocation: { latitude: 34.7612, longitude: 127.6645, accuracy: 20 } });   // 시연과 같은 여수 주삼동 언저리
  const P = await ctx.newPage();
  const 담기 = async () => {
    await 쉼(300);
    try {
      const g = await P.evaluate(긁기);
      모음[이름].add(고르게(g.보임));
      모음['숨은 글'].add(고르게(g.숨음));
    } catch (e) { /* 넘어가는 중 */ }
  };
  /* 한 걸음 — 막히면 적고 다음 걸음으로 갑니다(뒤 걸음의 글자도 모아야 하므로) */
  const 걸음 = async (도구, 설명, 할일) => {
    try { await 할일(); await 담기(); }
    catch (e) { 흐름오류.push(`[${이름}] ${도구} — ${설명}: ${String(e.message).split('\n')[0].slice(0, 140)}`); }
  };
  const 누르기 = async sel => { const e = P.locator(sel).first(); await e.scrollIntoViewIfNeeded({ timeout: 4000 }); await e.click({ timeout: 6000 }); };
  /* 휴대전화에서는 자료 출처·인쇄·초기화가 「메뉴」 안에 접혀 있습니다 — 숨어 있어도 눌러서 엽니다 */
  const 속눌러 = sel => P.evaluate(s => document.querySelector(s).click(), sel);
  /* 지도는 휴대전화에서 화면 아래로 이어져 있어, 칸 전체의 가운데를 누르면 화면 밖을 누르게 됩니다.
     지도를 화면에 들인 뒤 **보이는 부분의** 가운데를 누릅니다. */
  const 지도가운데 = async () => {
    await P.locator('#map').scrollIntoViewIfNeeded();
    const r = await P.evaluate(() => { const b = document.getElementById('map').getBoundingClientRect();
      const top = Math.max(b.top, 0), bot = Math.min(b.bottom, innerHeight);
      return { x: b.left + b.width / 2, y: (top + bot) / 2 }; });
    await P.mouse.click(r.x, r.y);
  };
  /* 02 알림 종류 — 휴대전화에서는 고른 것 한 줄만 남기고 접힙니다(「바꾸기」). 접혀 있으면 펼친 뒤 고릅니다. */
  const 알림고르기 = async s => {
    const 단추 = P.locator(`#stages button[data-s=${s}]`);
    if (!(await 단추.isVisible())) { await P.locator('#stages button[aria-pressed=true]').first().click(); await 쉼(400); }
    await 단추.click({ timeout: 6000 });
  };

  // 진입 화면
  await 걸음('진입 화면', '열기', async () => { await P.goto(BASE + 'index.html'); await 쉼(3000); });

  // 01 주민 대피장소 찾기 — README: 주소 칸에 여수시 주삼동 → 목록에서 고르기 → 지도를 한 번 눌러 확정
  await 걸음('01', '열기', async () => { await P.goto(BASE + 'map/index.html'); await 쉼(1000); });
  await 걸음('01', '주소 칸에 「여수시 주삼동」', async () => { await P.fill('#mAddrQ', '여수시 주삼동'); await 쉼(900); });
  await 걸음('01', '목록에서 고르기', async () => { await 누르기('#addrPop .mpk-row'); await 쉼(1200); });
  await 걸음('01', '지도를 한 번 눌러 사고지점 확정', async () => { await 지도가운데(); await 쉼(1500);
    const ok = await P.evaluate(() => !!document.querySelector('#mSum') && !document.querySelector('#mSum').hidden);
    if (!ok) throw new Error('요약 띠(사고지점·가장 가까운 곳)가 나오지 않음'); });
  await 걸음('01', '조건 더보기', async () => { const t = P.locator('#mbToggle'); if (await t.isVisible()) { await t.click(); await 쉼(300); } });
  await 걸음('01', '목록 첫 줄 누르기', async () => { await 누르기('#shList .ms-it'); await 쉼(900); });
  await 걸음('01', '자료 출처', async () => { await 속눌러('#btnSrc'); await 쉼(400); });
  await 걸음('01', '「이 내용으로 문자 만들기」 → 02', async () => { await P.keyboard.press('Escape'); await 속눌러('#btnToSms'); await P.waitForURL(/sms\//, { timeout: 8000 }); await 쉼(1200); });

  // 02 주민대피 문자생성기 — README: 실내대피 알림 → 한 화면에 한 가지씩(물질 암모니아)
  for (const s of ['indoor', 'detour', 'evac']) {
    await 걸음('02', `알림 종류 ${s}`, async () => { await P.goto(BASE + 'sms/index.html'); await 쉼(700); await 알림고르기(s); await 쉼(500); });
    /* 걸음 사이는 진행 띠로 옮겨 다닙니다 — 휴대전화에서는 띠가 옆으로 밀려 있어 손가락 대신 바로 누릅니다 */
    const 걸음들 = await P.$$eval('#stepBar button[data-go]', bs => bs.map(b => b.dataset.go)).catch(() => []);
    for (const g of 걸음들) await 걸음('02', `${s} · ${g}`, async () => { await 속눌러(`#stepBar button[data-go="${g}"]`); await 쉼(350); });
    await 걸음('02', `${s} · 칸 채우고 문안`, async () => {
      await P.evaluate(o => Object.keys(o).forEach(k => { const el = document.getElementById('if_' + k); if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); } }),
        { 기관: '여수시', 시각: '14:20', 시군: '여수시', 읍면동: '주삼동', 사업장: '○○화학', 대상지역: '주삼동 일원', 물질: '암모니아', 대피소: '여수웅천초등학교', 집결지: '주삼동 행정복지센터' });
      await 속눌러('#stepBar button[data-go=out]'); await 쉼(500);
      const f = P.locator('#out .ohd.fold').first(); if (await f.count()) { await f.click(); await 쉼(300); }
    });
  }
  await 걸음('02', '지도에서 찾기', async () => {
    const bs = await P.$$('#stepBar button[data-go]');
    for (const b of bs) if (/대피장소/.test(await b.textContent())) { await b.evaluate(e => e.click()); break; }
    await 쉼(300); await 누르기('#btnMap'); await 쉼(1300);
  });

  // 03 방제 물품·장비 찾기 — README: 방제물품 찾기 → 흡착포 → 사고지점 칸에 여수시 → 삼동2길 이 든 주소 고르기
  await 걸음('03', '열기', async () => { await P.goto(BASE + 'res/index.html'); await 쉼(1000); });
  await 걸음('03', '「방제물품 찾기」', async () => { await 누르기('#rzBr .rz-br[data-b="item"]'); await 쉼(500); });
  await 걸음('03', '「흡착포」', async () => { await 누르기('#rzNeeds .rz-item:has-text("흡착포")'); await 쉼(300); await 누르기('#rzNext'); await 쉼(500); });
  await 걸음('03', '사고지점 칸에 「여수시」', async () => { await P.fill('#startQ', '여수시'); await 쉼(900); });
  await 걸음('03', '「삼동2길」 이 든 주소 고르기', async () => { await 누르기('.mpk-row:has-text("삼동2길")'); await 쉼(1800);
    const ok = await P.locator('#shList .ms-it').count();
    if (!ok) throw new Error('목록이 나오지 않음'); });
  await 걸음('03', '줄을 누르면 세부 창', async () => { await 누르기('#shList .ms-it'); await 쉼(1000);
    if (!(await P.locator('.rkd-tel').count())) throw new Error('세부 창에 전화번호 칸이 없음'); });
  await 걸음('03', '동원 목록에 담기', async () => { await 누르기('.rkd button:has-text("동원 목록에 담기")'); await 쉼(500); });
  await 걸음('03', '자료 출처', async () => { await 속눌러('#btnSrc'); await 쉼(400); });
  await 걸음('03', '업체 섭외 갈래', async () => { await P.goto(BASE + 'res/index.html'); await 쉼(900); await 누르기('#rzBr .rz-br[data-b="biz"]'); await 쉼(500);
    await 누르기('#rzNeeds .rz-need'); await 쉼(300); await 누르기('#rzNext'); await 쉼(500); });

  // 04 현장 안전거리 확인 — README: 물질 암모니아 → 지도에서 사고지점 찍기 → 대규모 → 바람 남서 → 내 위치 확인
  await 걸음('04', '열기', async () => { await P.goto(BASE + 'safe/index.html'); await 쉼(900); });
  await 걸음('04', '물질 「암모니아」', async () => { await P.fill('#sfMat', '암모니아'); await 쉼(400); await 누르기('#mpkList .mpk-row'); await 쉼(400); });
  await 걸음('04', '지도에서 사고지점 찍기', async () => { await 누르기('#btnPick'); await 쉼(300); await 지도가운데(); await 쉼(800); });
  await 걸음('04', '「대규모」', async () => { await 누르기('#segSize button:has-text("대규모")'); await 쉼(300); });
  await 걸음('04', '바람 「남서」', async () => { await 누르기('#windBtn'); await 쉼(300); await 누르기('#windPop .wr-b[data-deg="225"]'); await 쉼(600); });
  await 걸음('04', '「내 위치 확인」', async () => { await 누르기('#btnWatch'); await 쉼(1200); });
  await 걸음('04', '물질 정보 더 보기', async () => { await 누르기('#sfInfo summary'); await 쉼(300); });
  await 걸음('04', '「상황 공유」', async () => {
    await P.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}
      try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) {}
      document.execCommand = () => false; });
    await 누르기('#btnShare'); await 쉼(600);
  });
  await 걸음('04', '공유받은 링크로 열기', async () => { await P.goto('about:blank');
    await P.goto(BASE + 'safe/index.html#m=' + encodeURIComponent('암모니아') + '&la=34.7604&lo=127.6622&z=l&w=225&t=d&at=202611101420'); await 쉼(1300); });
  await 걸음('04', '자료 출처', async () => { await 속눌러('#btnSrc'); await 쉼(400); });

  await B.close();
}

await 기기로돌기('화면(휴대전화)', devices['iPhone 13']);
await 기기로돌기('화면(PC)', { viewport: { width: 1366, height: 768 } });
서버.close();

/* 자료 — 「여수시 주삼동」·「암모니아」 같은 입력값은 화면이 아니라 자료에 있어야 맞습니다 */
const 자료글 = 고르게(fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')).join('\n'));
const 덩어리 = Object.fromEntries(Object.entries(모음).map(([k, v]) => [k, [...v].join('\n')]));

/* ── ③ 대조 ───────────────────────────────────────────────────── */
const 부정 = /않|없|빼|금지|넣지|쓰지/;
const 결과줄 = [];
let 문제수 = 0;
for (const 문서 of DOCS) {
  const 줄들 = 문서글(문서);
  const 낱말들 = 낱말뽑기(줄들, /\.md$/i.test(문서));
  const 칸 = { 있음: [], 나눠있음: [], 자료: [], 부정: [], 없음: [], 참고없음: [] };
  for (const w of 낱말들) {
    const 어디 = Object.keys(덩어리).filter(k => 찾기(w.글, 덩어리[k]));
    if (어디.length) { 칸.있음.push({ w, 어디 }); continue; }
    const 조각 = w.글.split(/\s*[·\/→,]\s*|\s+또는\s+|\s+—\s+/).map(x => x.trim()).filter(x => x.length >= 2);
    if (조각.length > 1 && 조각.every(c => Object.values(덩어리).some(d => 찾기(c, d)) || 찾기(c, 자료글))) { 칸.나눠있음.push({ w }); continue; }
    if (찾기(w.글, 자료글)) { 칸.자료.push({ w }); continue; }
    if ((w.종류 === '낫표' || w.종류 === '코드') && w.자리.some(z => 부정.test(z.줄))) { 칸.부정.push({ w }); continue; }
    (w.종류 === '따옴표' || w.종류 === '굵은글' || w.종류 === '파일' ? 칸.참고없음 : 칸.없음).push({ w });
  }
  문제수 += 칸.없음.length;
  const 자리 = w => w.자리.map(z => `${z.줄번호}줄: ${z.줄}`).join('\n      ');
  결과줄.push(`## ${path.basename(문서)}`, '',
    `낱말 후보 ${낱말들.length}개 — 화면에 있음 ${칸.있음.length} · 나눠서 모두 있음 ${칸.나눠있음.length} · 자료(입력값) ${칸.자료.length} · ` +
    `부정 문맥 ${칸.부정.length} · **화면에 없음 ${칸.없음.length}** · 참고(따옴표·굵은 글) 없음 ${칸.참고없음.length}`, '');
  if (칸.없음.length) {
    결과줄.push('### ✗ 화면에 없음 — 글을 화면 이름에 맞추거나, 화면 낱말이 아니면 그대로 둠', '');
    칸.없음.forEach(({ w }) => 결과줄.push(`- 「${w.글}」 (${w.종류})`, `      ${자리(w)}`));
    결과줄.push('');
  }
  if (칸.부정.length) {
    결과줄.push('### △ 부정 문맥 — "화면에 없다" 고 쓴 줄일 수 있음(사람이 확인)', '');
    칸.부정.forEach(({ w }) => 결과줄.push(`- 「${w.글}」`, `      ${자리(w)}`));
    결과줄.push('');
  }
  if (칸.참고없음.length) {
    결과줄.push('### · 참고 — 따옴표·굵은 글 가운데 화면에 없는 것(대개 강조·인용이라 괜찮음)', '');
    칸.참고없음.forEach(({ w }) => 결과줄.push(`- ${w.글}  (${w.자리[0].줄번호}줄)`));
    결과줄.push('');
  }
  결과줄.push('### ✓ 화면에 있음', '');
  칸.있음.forEach(({ w, 어디 }) => 결과줄.push(`- 「${w.글}」 — ${어디.join(' · ')}`));
  칸.나눠있음.forEach(({ w }) => 결과줄.push(`- 「${w.글}」 — 나눠서 모두 있음`));
  칸.자료.forEach(({ w }) => 결과줄.push(`- 「${w.글}」 — 자료(입력값)`));
  결과줄.push('');
}
결과줄.unshift('# 설명서 ↔ 화면 대조', '',
  `휴대전화(아이폰 13)·PC(1366×768)로 진입 화면과 도구 넷을 README 순서대로 눌러 모은 화면 글자와 대조했습니다.`, '',
  흐름오류.length ? `## ✗ 흐름 오류 ${흐름오류.length}건 — 글대로 따라가다 막힌 걸음\n\n` + 흐름오류.map(x => '- ' + x).join('\n') + '\n'
    : '## ✓ 흐름 오류 없음 — 휴대전화·PC 모두 글대로 끝까지 따라감\n', '');
const 보고 = 결과줄.join('\n');
if (OUT) { fs.writeFileSync(OUT, 보고); console.log('결과: ' + OUT); }
console.log(보고.split('\n').filter(l => /^(#|- 「|낱말 후보|      \d)/.test(l) && !/^### ✓/.test(l)).slice(0, 400).join('\n').replace(/\n## ✓ 화면에 있음[\s\S]*$/, ''));
console.log(`\n흐름 오류 ${흐름오류.length}건 · 화면에 없음 ${문제수}건`);
process.exit(흐름오류.length || 문제수 ? 1 : 0);
