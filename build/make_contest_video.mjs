/* 공모전 시연영상 — 휴대전화 화면 · 이야기형
   ───────────────────────────────────────────────────────────────
       node build/make_contest_video.mjs

   결과물 : docs/공모전_시연영상.mp4  (1920×1080 · 30fps · 5분 안)

   ── 왜 새로 만들었나 (2026-11-09 사용자) ─────────────────────────
   2026 공공 AI 대전환 챌린지 세션1 에 냅니다(시연영상 약 5분 이내 · mp4).
   사용자 — "휴대전화 화면만 쓸 거야. 우리의 시연 영상이 너무 밋밋해서 …
   동적으로 사람들이 몰입해서 볼 수 있는 영상이 되었으면 … 흥미진진하게 쉽게
   설명해 주었으면" · "휴대전화를 메인으로 밀고 나갈 것".
   그래서 예전 영상(make_demo.mjs · PC 1280×800 · 자막 한 줄)과 다르게
     · **이야기**가 있습니다 — 가상 사고 → 담당자가 할 일 셋 → 미션 01·02·03
       → 정리. 미션마다 "무엇을 찾나"를 질문으로 걸어 둡니다.
     · **휴대전화만** 나옵니다 — 1920×1080 무대(build/영상무대.html) 가운데에
       휴대전화를 세우고, 그 안(iframe)에서 실제 서비스를 손가락으로 누릅니다.
     · 누른 자리에 **손가락 자국**, 중요한 칸은 **확대 + 노란 고리**,
       오른쪽에는 쌓이는 **큰 자막**.
     · 02 에서 고른 대피장소를 **「이 내용으로 문자 만들기」로 03 에 넘깁니다**
       — 세 화면이 따로 노는 것이 아니라 이어진다는 것을 보여 줍니다.

   ── 지키는 것 ─────────────────────────────────────────────────
   · 화면을 그려 넣지 않습니다. 휴대전화 안은 **실제 서비스**이고 목록·숫자는
     실제 자료입니다. 무대는 테두리·자막·확대만 맡습니다.
   · **가상 상황**임을 처음부터 끝까지 밝힙니다(오른쪽 위 띠 + 왼쪽 상황 카드).
     사업장은 ○○화학 — 실제 회사 이름을 사고 예시에 쓰지 않습니다
     (영상은 대회 홍보에 쓰일 수 있습니다 — 참가신청서 동의 항목).
   · "판단은 담당자가 합니다" 를 자막으로 한 번 분명히 말합니다(CLAUDE.md 2절).
   · 걸린 시간을 자랑하는 숫자를 넣지 않습니다 — 녹화는 기계가 빠르게 누른
     것이라 사람이 쓰는 시간이 아닙니다. 재지 않은 값을 잰 값처럼 보이게 하면
     안 됩니다.

   ── 녹화 방법 ─────────────────────────────────────────────────
   playwright 의 recordVideo 는 화질이 낮게 고정되어(1Mbps) 1080 화면의 글자가
   뭉갭니다. 그래서 크롬 개발자 도구의 화면 중계(Page.startScreencast)로
   **바뀐 장면만** JPEG 로 받아 두고, 받은 시각대로 이어 붙여 mp4 를 굽습니다.
   무대 바탕은 일부러 움직이지 않게 두었습니다 — 움직이면 장면마다 모든 칸이
   바뀌어 받을 그림이 몇 배로 늘고, 눈도 어디를 볼지 모릅니다.

   ── 배경지도 ───────────────────────────────────────────────────
   개발 자리는 타일 서버로 못 나가 지도에 경계선만 나옵니다(CLAUDE.md 6절).
   내는 판은 액션 러너에서 굽습니다 — .github/workflows/공모전영상_굽기.yml.
   ─────────────────────────────────────────────────────────── */
import { chromium, devices } from 'playwright';
import http from 'http';
import path from 'path';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync,
         readFileSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const 작업방 = `${RPATH}/.contest-tmp`;
const 낼 = `${RPATH}/docs/공모전_시연영상.mp4`;
rmSync(작업방, { recursive: true, force: true });
mkdirSync(작업방, { recursive: true });

/* ── 작은 서버 — 무대와 서비스를 **같은 주소**에서 열어야 iframe 안을
      자유롭게 다룰 수 있습니다(file:// 은 칸마다 남남으로 취급합니다). ── */
const 종류 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const 서버 = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(RPATH, path.normalize(u));
  if (!f.startsWith(RPATH) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 종류[path.extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(r);
});
await new Promise((ok) => 서버.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${서버.address().port}`;

/* 시각 칸(type=time)은 브라우저 언어를 따라 그립니다 — 안 주면 "02:20 PM" 으로
   나왔습니다. 화면 언어를 한국어로 띄웁니다. */
const browser = await chromium.launch({ args: ['--lang=ko-KR'] });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  /* 손가락으로 쓰는 기기처럼 — 휴대전화 화면의 큰 단추(pointer: coarse)가 나옵니다 */
  hasTouch: true, userAgent: devices['iPhone 13'].userAgent,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  /* 01 에서 「지금 내가 있는 곳」을 누릅니다 — 현장에 나온 담당자의 휴대전화라는
     설정입니다. 여수 주삼동(여천초 언저리 · 가상 사고 자리). ③ 의 검색 색인에는
     '주삼동'이 없어(방제 자료 주소에 그 동 이름이 따로 안 잡힘) 이름으로 못 찾습니다. */
  permissions: ['geolocation'],
  geolocation: { latitude: 34.7905, longitude: 127.6520, accuracy: 25 },
  serviceWorkers: 'block',
});
/* 이 녹화 자리에서만 뜨는 띠를 가립니다(휴대전화 사용설명서와 같은 것들).
   실제 주소에서는 안 뜨는 것이라 영상에 남기면 고장처럼 보입니다. 무대에는
   붙이지 않고 휴대전화 안(iframe)에만 붙입니다. */
await ctx.addInitScript(() => {
  if (window.top === window) return;
  const 붙이기 = () => {
    if (!document.head) return setTimeout(붙이기, 20);
    const s = document.createElement('style');
    s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}';
    document.head.appendChild(s);
  };
  붙이기();
});
const p = await ctx.newPage();
const 문제 = [];
p.on('pageerror', (e) => 문제.push('화면 오류: ' + e.message));

/* ── 손놀림 ────────────────────────────────────────────────── */
const 잠깐 = (ms) => p.waitForTimeout(ms);
const 앱 = () => p.frame({ name: 'app' });
const 찾기 = (대상) => (typeof 대상 === 'string' ? 앱().locator(대상).first() : 대상);
/* 자막 — 띄운 뒤 **읽을 시간**만큼 기다립니다. 처음 판은 자막과 동시에 눌러
   버려 2분 41초 만에 끝났고, 글을 읽기 전에 화면이 넘어갔습니다. 글자 수로
   읽는 시간을 잡습니다(한 글자 70ms · 짧아도 1.3초). `ms` 를 주면 그 값을 씁니다. */
const 말 = async (t, 종류, ms) => {
  await p.evaluate(([a, b]) => window.무대.말(a, b), [t, 종류 || '']);
  const 글자 = t.replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
  await 잠깐(ms != null ? ms : Math.max(1300, 글자 * 70));
};

/* 휴대전화 화면 밖에 있으면 **부드럽게** 굴려 가운데로 — 뚝 끊겨 넘어가면
   보는 사람이 어디로 왔는지 놓칩니다. */
const 보이게 = async (loc) => {
  const 안 = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 70 && r.bottom <= innerHeight - 70;
  });
  if (!안) {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await 잠깐(800);
  }
};

/* 누르기 — 손가락 자국을 먼저 보이고, 그 자리를 실제로 누릅니다 */
const 누르기 = async (대상, { 앞 = 300, 뒤 = 800, fx = 0.5, fy = 0.5 } = {}) => {
  const loc = 찾기(대상);
  try { await loc.waitFor({ state: 'visible', timeout: 9000 }); }
  catch (e) { 문제.push('못 찾음: ' + 대상); return false; }
  await 보이게(loc);
  const b = await loc.boundingBox();
  if (!b) { 문제.push('자리 없음: ' + 대상); return false; }
  const x = b.x + b.width * fx, y = b.y + b.height * fy;
  await p.evaluate(([a, c]) => window.무대.톡(a, c), [x, y]);
  await 잠깐(앞);
  await p.touchscreen.tap(x, y);
  await 잠깐(뒤);
  return true;
};

/* 칸에 **실제로 쳐 넣습니다** — 값을 밀어 넣으면 채우는 과정이 화면에 남지 않습니다
   (2026-09-14 사용자 — "중간에 작성과정 스킵하잖아"). */
const 치기 = async (칸, 값, 속도 = 85) => {
  if (!(await 누르기(칸, { 뒤: 200 }))) return false;
  const loc = 찾기(칸);
  await loc.fill('');
  await loc.pressSequentially(값, { delay: 속도 });
  await 잠깐(350);
  return true;
};

/* 한 자리를 크게 — 휴대전화를 그 자리 중심으로 키웠다가 되돌립니다 */
const 크게 = async (대상, S = 1.8, ms = 2400) => {
  const loc = 찾기(대상);
  if (!(await loc.count())) { 문제.push('확대할 자리 없음: ' + 대상); return; }
  await 보이게(loc);
  const b = await loc.boundingBox();
  await p.evaluate(([r, s]) => window.무대.확대(r, s), [b, S]);
  await 잠깐(ms);
  await p.evaluate(() => window.무대.원래());
  await 잠깐(950);
};

/* 휴대전화 안 화면을 부드럽게 굴립니다 */
const 굴리기 = async (dy, ms = 1100) => {
  await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), dy);
  await 잠깐(ms);
};
const 맨위로 = async (ms = 700) => {
  await 앱().evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await 잠깐(ms);
};

/* 어림잡은 자리면 서비스가 "지도를 누르세요" 를 띄웁니다 — 그것이 이 서비스의
   원칙이라(어림값을 잰 값처럼 쓰지 않는다) 영상에서도 지도를 한 번 눌러 확정합니다. */
const 지도확정 = async () => {
  const 묻는가 = await 앱().locator('text=지도를 누르세요').count();
  if (!묻는가) return;
  await 말('어림잡은 위치는 <b>지도에서 한 번 더</b> 눌러 확정합니다', 'key');
  /* 한가운데를 누르면 그 동의 대피장소 위에 정확히 찍혀 '가장 가까운 곳 0m' 가
     나왔습니다(주삼동은 대피장소가 한 곳이라 동 가운데 = 그 학교). 조금 비켜 누릅니다. */
  await 누르기('.mmap', { 앞: 450, 뒤: 1300, fx: 0.38, fy: 0.36 });
};

/* 배경지도가 실제로 그려졌는지 셉니다 — 개발 자리에서는 0 이 정상입니다 */
let 타일 = 0;
/* 오래 기다리면 그 자리가 영상에서 가장 긴 정지 화면이 됩니다(개발 자리에서
   9초 멈춰 있었습니다). 러너에서는 1~2초면 타일이 옵니다. */
const 타일기다리기 = async (최대 = 4000) => {
  const 끝 = Date.now() + 최대;
  while (Date.now() < 끝) {
    타일 = await 앱().evaluate(() => document.querySelectorAll('svg image[data-t]').length);
    if (타일 > 0) break;
    await 잠깐(400);
  }
  await 잠깐(타일 > 0 ? 900 : 200);
};

/* ── 녹화 시작 ─────────────────────────────────────────────── */
await p.goto(`${BASE}/build/${encodeURIComponent('영상무대.html')}`);
await p.evaluate(() => document.fonts.ready);
await 잠깐(400);

const cdp = await ctx.newCDPSession(p);
const 시각들 = [];
cdp.on('Page.screencastFrame', (f) => {
  const i = 시각들.length;
  writeFileSync(`${작업방}/f${String(i).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  시각들.push(f.metadata && f.metadata.timestamp ? f.metadata.timestamp : Date.now() / 1000);
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080 });
const 시작 = Date.now();

/* ══ 0. 여는 장면 ═══════════════════════════════════════════
   표지가 도는 동안 뒤에서 진입 화면을 미리 엽니다 — 막이 걷히는 순간 카드가
   다 올라와 있어야 합니다. */
const 표지 = p.evaluate(() => window.무대.표지());
await 잠깐(12500);
await p.evaluate((u) => window.무대.열기(u), `${BASE}/index.html`);
await 표지;

await p.evaluate(() => window.무대.머리('시작', '링크 하나로 열립니다', '설치 · 회원가입 없이 — 휴대전화 브라우저에서'));
await 말('<b>QR</b> 을 비추거나 링크를 누르면 바로 이 화면');
await 말('첫 번째 — <b>방제 물품</b>부터 찾아봅니다');
await 누르기('#tools .pn', { 뒤: 200 });

/* ══ 1. 01 방제 물품·장비 찾기 ════════════════════════════ */
await p.evaluate(() => window.무대.미션(1, '흡착포, 어디에 있지?', '01 방제 물품·장비 찾기'));
await 잠깐(300);
await 말('물건을 찾는지, 업체를 부르는지 <b>먼저 고르고</b>');
await 누르기('.rz-br >> nth=1', { 뒤: 1000 });
await 말('필요한 물품을 누릅니다 — <b>흡착포</b>');
await 누르기(앱().locator('.rz-item', { hasText: '흡착포' }).first(), { 뒤: 600 });
await 누르기('#rzNext', { 뒤: 1000 });
await 말('사고지점은 주소 · 사업장 이름 · 지도 · <b>내 위치</b> 중 편한 것으로');
await 말('현장에 나와 있다면 — <b>지금 내가 있는 곳</b> 한 번이면');
await 누르기('#startMe', { 뒤: 1600 });
await 지도확정();
await 타일기다리기();
await 맨위로();
await 말('가까운 곳이 <b>지도에 바로</b> — 아이콘으로 무엇인지 구분', '', 2900);
await 말('목록은 아래에 — <b>안내를 누르면</b> 바로 내려갑니다');
if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 1300 });
else await 굴리기(600, 1200);
await 말('가진 곳 · 거리 · <b>보유 수량</b>까지 한눈에');
await 굴리기(240, 1600);
/* 전화번호가 있는 줄을 고릅니다 — 세부 창의 주인공이 번호입니다(없는 번호를 지어
   넣지 않으므로 있는 줄을 찾아 누릅니다). */
const 줄들 = 앱().locator('#shList .ms-it');
let 고른 = 0;
for (let i = 0; i < Math.min(await 줄들.count(), 12); i++) {
  if (/\d{2,4}-\d{3,4}-\d{4}/.test(await 줄들.nth(i).innerText())) { 고른 = i; break; }
}
await 말('누르면 <b>연락처가 가장 크게</b> — 바로 전화');
await 누르기(줄들.nth(고른), { 뒤: 1400 });
await 크게('.rkd-tel', 1.9, 2600);
await 말('그 자리에 있는 <b>다른 물품과 수량</b>도 함께');
await 크게('.rkd-items', 1.45, 2400);
await 누르기('.rkd-close', { 뒤: 600 });
await p.evaluate(() => window.무대.완료(1, '흡착포를 가진 곳 · 수량 · 연락처까지'));

/* ══ 2. 02 주민 대피장소 찾기 ══════════════════════════════ */
const 미션2 = p.evaluate(() => window.무대.미션(2, '주민을 어디로 피하게 하지?', '02 주민 대피장소 찾기'));
await 잠깐(500);
await p.evaluate((u) => window.무대.열기(u), `${BASE}/map/index.html`);
await 미션2;
await 말('이번에는 <b>주소</b>로 — 같은 자리를 넣습니다');
await 치기('#mAddrQ', '여수시 주삼동', 110);
await 잠깐(900);
await 누르기('#addrPop .mpk-row', { 뒤: 1300 });
await 지도확정();
await 타일기다리기();
await 맨위로();
await 말('가장 가까운 곳과 <b>반경별 개수</b>가 한 줄로');
await 크게('#mSum', 1.75, 2600);
await 말('<b>화학사고 대피장소</b>와 <b>이재민 임시주거시설</b>을 나눠 봅니다');
await 크게('#mLayers', 1.6, 2400);
await 말('거리 · 도보시간 · 수용인원 — <b>가까운 순</b>으로');
if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 1300 });
await 누르기('#shList .ms-it', { 뒤: 1500 });
await 말('어디로 보낼지는 <b>담당자가 정합니다</b> — 서비스는 자료를 모아 보여 줄 뿐', 'key', 2900);
await 말('고른 곳을 <b>문자로 바로</b> 넘깁니다');
await 보이게(찾기('#btnToSms'));
await p.evaluate(() => window.무대.완료(2, '가까운 대피장소 · 반경별 개수 · 수용인원'));
await 누르기('#btnToSms', { 뒤: 300 });

/* ══ 3. 03 주민대피 문자생성기 ═════════════════════════════ */
await p.evaluate(() => window.무대.미션(3, '주민에게 알려야 한다', '03 주민대피 문자생성기'));
await 말('대피장소 · 지역이 <b>미리 채워져</b> 넘어옵니다', '', 900);
if (await 앱().locator('#seedBar:not([hidden])').count()) await 크게('#seedBar', 1.55, 2300);
await 말('보낼 알림을 고르고 — <b>주민대피(대피명령)</b>');
await 누르기('#stages button[data-s=evac]', { 뒤: 1100 });
const 다음 = () => 누르기('#stepNav .sn-next', { 앞: 260, 뒤: 900 });
await 말('한 화면에 <b>한 가지씩</b> 묻습니다');
await 누르기('#types button[data-t="누출"]', { 뒤: 600 });
await 다음();
await 치기('#if_기관', '여수시');
await 누르기('#if_시각', { 뒤: 200 });
await 찾기('#if_시각').fill('14:20');
await 잠깐(500);
await 다음();
await 말('사고 위치 · 문자 받을 지역을 차례로');
if (!(await 찾기('#if_시군').inputValue().catch(() => ''))) await 치기('#if_시군', '여수시');
await 치기('#if_읍면동', '주삼동');
await 치기('#if_사업장', '○○화학', 120);
await 다음();
await 치기('#if_대상지역', '주삼동 일원');
await 다음();
await 말('사고물질은 <b>목록에서 찾아</b> 고릅니다');
await 치기('#if_물질', '염산', 140);
await 잠깐(700);
await 누르기(앱().locator('.mpk-row').first(), { 뒤: 900 });
await 다음();
await 말('대피장소는 <b>지도에서 고른 곳</b>이 그대로');
await 잠깐(1800);
await 다음();
await 맨위로(500);
await 말('승인받은 <b>표준문안</b> 그대로 — 글자수까지', '', 600);
await 크게('#out .out:not(.bad) .msg', 1.5, 3200);
await 말('<b>복사</b>해서 문자 발송시스템에 붙이면 끝');
await 누르기('#out .out:not(.bad) footer button.p', { 뒤: 1400 });
await p.evaluate(() => window.무대.완료(3, '승인받은 표준문안 · 글자수 확인 · 복사'));

/* ══ 4. 마무리 ═════════════════════════════════════════════ */
await p.evaluate(() => window.무대.마무리());

await cdp.send('Page.stopScreencast');
const 끝 = Date.now();
await ctx.close();
await browser.close();
서버.close();

/* ── 받은 장면을 받은 시각대로 이어 붙입니다 ───────────────────── */
if (시각들.length < 30) { console.error('⚠ 받은 장면이 너무 적습니다: ' + 시각들.length); process.exit(1); }
const 마지막 = 시각들[0] + (끝 - 시작) / 1000;
let 목록 = 'ffconcat version 1.0\n';
for (let i = 0; i < 시각들.length; i++) {
  const 다음시각 = i + 1 < 시각들.length ? 시각들[i + 1] : Math.max(마지막, 시각들[i] + 0.5);
  const 길이 = Math.max(0.001, 다음시각 - 시각들[i]);
  목록 += `file 'f${String(i).padStart(6, '0')}.jpg'\nduration ${길이.toFixed(4)}\n`;
}
/* concat 은 마지막 줄의 길이를 무시하므로 마지막 장면을 한 번 더 적습니다 */
목록 += `file 'f${String(시각들.length - 1).padStart(6, '0')}.jpg'\n`;
writeFileSync(`${작업방}/목록.ffconcat`, 목록);

const ff = process.env.FFMPEG || 'ffmpeg';
const 프리셋 = process.env.FFPRESET || 'slow';
console.log(`장면 ${시각들.length}장 · ${((끝 - 시작) / 1000).toFixed(1)}초 — mp4 로 굽는 중 (preset ${프리셋})`);
execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
  '-i', `${작업방}/목록.ffconcat`, '-vf', 'fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 프리셋, '-crf', process.env.FFCRF || '23',
  '-movflags', '+faststart', '-an', 낼], { stdio: ['ignore', 'inherit', 'inherit'] });
rmSync(작업방, { recursive: true, force: true });

const 길이 = +String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'csv=p=0', 낼], { encoding: 'utf8' }).stdout || 0);
const 크기 = readFileSync(낼).length / 1024 / 1024;
console.log(`docs/공모전_시연영상.mp4  ${Math.floor(길이 / 60)}분 ${Math.round(길이 % 60)}초 · ${크기.toFixed(1)}MB`);
console.log(타일 > 0 ? `  배경지도 타일 ${타일}장 — 도로·건물이 나옵니다`
                    : '  배경지도 타일 없음 — 경계선만(개발 자리에서는 정상)');
if (길이 > 300) 문제.push(`영상이 ${길이.toFixed(0)}초 — 5분(300초)을 넘습니다`);
if (문제.length) {
  console.error('\n⚠ 고칠 것');
  [...new Set(문제)].forEach((m) => console.error('  · ' + m));
  process.exitCode = 1;
}
