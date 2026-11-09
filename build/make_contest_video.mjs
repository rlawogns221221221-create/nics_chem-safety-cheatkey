/* 공모전 시연영상 — 휴대전화 화면 · 나레이션 · 배경음악
   ───────────────────────────────────────────────────────────────
       node build/make_contest_video.mjs

   결과물 : docs/공모전_시연영상.mp4  (1920×1080 · 30fps · 5분 안 · 소리 있음)

   ── 무엇을 보여 주나 (2026-11-09 사용자) ─────────────────────────
   2026 공공 AI 대전환 챌린지 세션1 에 냅니다(시연영상 약 5분 이내 · mp4).
   · **휴대전화 화면만** — 1920×1080 무대(build/영상무대.html) 가운데에 휴대전화를
     세우고, 그 안(iframe)에서 실제 서비스를 손가락으로 누릅니다.
   · 차례는 **01 주민 대피장소 → 02 주민대피 문자 → 03 방제 물품·장비**
     (사용자 — "공모전의 형태로 1.주민대피장소 찾기, 2.주민대피문자작성,
     3.방제자원찾기"). 01 에서 고른 대피장소를 「이 내용으로 문자 만들기」로
     02 에 넘깁니다 — 세 화면이 이어진다는 것을 보여 줍니다.
   · 01 에서 **대피장소까지 가는 길(도보 경로)** 과 **카카오맵 연결**을 보여 줍니다.
     카카오맵은 링크를 누르면 새 창으로 열리므로, **그 주소를 실제로 열어 찍은
     화면**을 휴대전화 안에 밀어 넣습니다(그려 넣은 가짜가 아닙니다). 못 열면
     넣지 않고 자막만 띄웁니다.
   · 02 의 사고물질은 **암모니아**(사용자 지정).
   · 03 은 **업체 섭외와 방제물품 찾기 둘 다** 보여 줍니다(사용자 — "이 두 가지가
     다 보여지면 좋을 것 같아").
   · **업체명과 전화번호는 흐리게 가립니다**(사용자 — "업체명과 번호는 안 보일 수
     있게"). 실제 자료라 실제 회사가 나오기 때문입니다. 대피장소(학교·주민센터)
     이름은 공공시설이라 그대로 두고, 전화번호는 어디서든 가립니다.
   · **여는 장면은 서비스 이름 한 장뿐**입니다 — 가상 사고 알림 등은 걷어냈습니다
     (사용자 — "가상상황과 앞선 내용은 없어도 될 것 같아. 15초부터 시작하는 느낌").
   · **여성 나레이션 + 배경음악**(사용자 — "음악과 여성의 음성이 추가되면").
     나레이션은 build/make_narration.py(MeloTTS · 러너), 음악은 build/make_music.py
     (직접 합성)가 만듭니다. 나레이션 파일이 없으면(개발 자리) 대본 글자 수로 길이를
     어림해 같은 박자로 녹화하고 소리는 음악만 넣습니다.

   ── 지키는 것 ─────────────────────────────────────────────────
   · 화면을 그려 넣지 않습니다. 휴대전화 안은 **실제 서비스**이고 목록·숫자는
     실제 자료입니다. 무대는 테두리·자막·확대만 맡습니다.
   · 사업장은 ○○화학 — 실제 회사 이름을 사고 예시에 쓰지 않습니다.
   · "판단은 담당자가 합니다" 를 분명히 말합니다(CLAUDE.md 2절).
   · 걸린 시간을 자랑하는 숫자를 넣지 않습니다 — 녹화는 기계가 빠르게 누른
     것이라 사람이 쓰는 시간이 아닙니다.
   · 나레이션은 **화면에 실제로 나오는 것만** 말합니다(build/영상대본.json).

   ── 녹화 방법 ─────────────────────────────────────────────────
   playwright 의 recordVideo 는 화질이 낮게 고정되어(1Mbps) 1080 화면의 글자가
   뭉갭니다. 그래서 화면 중계(Page.startScreencast)로 **바뀐 장면만** JPEG 로 받아
   두고, 받은 시각대로 이어 붙여 mp4 를 굽습니다. 나레이션은 말을 시작한 시각을
   적어 두었다가 그 자리에 맞춰 섞습니다.

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
const 소리방 = `${RPATH}/.narr`;
const 낼 = `${RPATH}/docs/공모전_시연영상.mp4`;
rmSync(작업방, { recursive: true, force: true });
mkdirSync(작업방, { recursive: true });

/* ── 나레이션 — 대본과 줄마다의 길이 ─────────────────────────── */
const 대본 = JSON.parse(readFileSync(`${RPATH}/build/영상대본.json`, 'utf8'));
const 길이표 = existsSync(`${소리방}/길이.json`)
  ? JSON.parse(readFileSync(`${소리방}/길이.json`, 'utf8')) : {};
const 소리있음 = Object.keys(길이표).length > 0
  && Object.keys(대본).filter((k) => !k.startsWith('_')).every((k) => 길이표[k] && existsSync(`${소리방}/${k}.wav`));
console.log(소리있음 ? `나레이션 ${Object.keys(길이표).length}줄을 씁니다`
                    : '나레이션 파일이 없습니다 — 대본 글자 수로 길이를 어림해 녹화합니다(소리는 음악만)');

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

/* 시각 칸(type=time)은 브라우저 언어를 따라 그립니다 — 화면 언어를 한국어로 띄웁니다. */
const browser = await chromium.launch({ args: ['--lang=ko-KR'] });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  /* 손가락으로 쓰는 기기처럼 — 휴대전화 화면의 큰 단추(pointer: coarse)가 나옵니다 */
  hasTouch: true, userAgent: devices['iPhone 13'].userAgent,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  /* 03 에서 「지금 내가 있는 곳」을 누릅니다 — 현장에 나온 담당자의 휴대전화라는
     설정입니다(여수 주삼동). ③ 의 검색 색인에는 '주삼동'이 없어 이름으로 못 찾습니다. */
  permissions: ['geolocation'],
  geolocation: { latitude: 34.7905, longitude: 127.6520, accuracy: 25 },
  serviceWorkers: 'block',
});
/* 휴대전화 안(iframe)에만 붙이는 것 — 무대에는 붙이지 않습니다.
   ① 이 녹화 자리에서만 뜨는 띠(배경지도 경고 등)를 가립니다.
   ② **업체명·전화번호를 흐립니다**(2026-11-09 사용자). 전화번호는 어느 화면이든,
      업체명은 방제(③) 화면에서만 — 대피장소는 학교·주민센터 같은 공공시설입니다.
      지도 위 이름 글씨(svg text.mkl)는 흐리기보다 아예 숨깁니다 — SVG 글자에는
      흐리기가 고르게 먹지 않아 읽히는 경우가 있었습니다. */
await ctx.addInitScript(() => {
  if (window.top === window) return;
  const 방제 = /\/res\//.test(location.pathname);
  const 붙이기 = () => {
    if (!document.head) return setTimeout(붙이기, 20);
    const s = document.createElement('style');
    s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
      + 'a[href^="tel:"],.rs-num,.rkd-tel,.rkd-tel2{filter:blur(7px)!important}'
      + (방제 ? '.ms-it .l1 b,.rkd header b,.mnear-it b,#mAddr b,.__가림{filter:blur(6px)!important}'
              + '.__가림{font-style:normal}svg text.mkl{display:none!important}' : '');
    document.head.appendChild(s);
  };
  붙이기();
  /* 요약 띠의 '가장 가까운 곳 ○○○' 은 이름이 태그 없이 글자로만 들어 있어
     CSS 로는 그 이름만 집을 수 없습니다 — 그 글자를 감싸서 흐립니다. */
  if (방제) {
    const 감싸기 = () => document.querySelectorAll('.ms-near').forEach((el) => {
      [...el.childNodes].forEach((n) => {
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const i = document.createElement('i');
        i.className = '__가림'; i.textContent = n.textContent;
        el.replaceChild(i, n);
      });
    });
    new MutationObserver(감싸기).observe(document, { childList: true, subtree: true });
  }
});
const p = await ctx.newPage();
const 문제 = [];
p.on('pageerror', (e) => 문제.push('화면 오류: ' + e.message));

/* ── 손놀림 ────────────────────────────────────────────────── */
const 잠깐 = (ms) => p.waitForTimeout(ms);
const 앱 = () => p.frame({ name: 'app' });
const 찾기 = (대상) => (typeof 대상 === 'string' ? 앱().locator(대상).first() : 대상);
const 열기 = (주소) => p.evaluate((u) => window.무대.열기(u), `${BASE}/${주소}`);

/* 나레이션 — 앞 줄이 끝날 때까지 기다렸다가 다음 줄을 시작합니다(겹치지 않게).
   말하는 동안 화면은 계속 움직입니다 — 기다리는 것은 **다음 말** 뿐입니다.
   시작 시각을 적어 두었다가 굽고 나서 그 자리에 소리를 얹습니다. */
const 말한것 = [];
let 말끝 = 0;
const 어림길이 = (글) => Math.max(1.4, 글.replace(/\s/g, '').length * 0.15);
const 나레이션 = async (k) => {
  if (!(k in 대본)) { 문제.push('대본에 없는 줄: ' + k); return; }
  const 남 = 말끝 - Date.now();
  if (남 > 0) await 잠깐(남);
  const d = 길이표[k] || 어림길이(대본[k]);
  말한것.push({ k, t: Date.now() / 1000 });
  말끝 = Date.now() + d * 1000 + 350;
};
const 말다하기 = async (더 = 0) => {
  const 남 = 말끝 - Date.now() + 더;
  if (남 > 0) await 잠깐(남);
};

/* 자막 — 나레이션이 박자를 잡으므로 자막은 짧게 읽을 시간만 둡니다 */
const 말 = async (t, 종류, ms) => {
  await p.evaluate(([a, b]) => window.무대.말(a, b), [t, 종류 || '']);
  const 글자 = t.replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
  await 잠깐(ms != null ? ms : Math.max(900, 글자 * 50));
};

/* 휴대전화 화면 밖에 있으면 **부드럽게** 굴려 가운데로 */
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

const 굴리기 = async (dy, ms = 1100) => {
  await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), dy);
  await 잠깐(ms);
};
const 맨위로 = async (ms = 700) => {
  await 앱().evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await 잠깐(ms);
};
const 목록으로 = async () => {
  if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 1200 });
  else await 보이게(찾기('#shList'));
};

/* 어림잡은 자리면 서비스가 "지도를 누르세요" 를 띄웁니다 — 그것이 이 서비스의
   원칙이라(어림값을 잰 값처럼 쓰지 않는다) 영상에서도 지도를 한 번 눌러 확정합니다.
   한가운데를 누르면 그 동의 대피장소 위에 정확히 찍혀 '0m' 가 나와 조금 비켜 누릅니다. */
const 지도확정 = async () => {
  if (!(await 앱().locator('text=지도를 누르세요').count())) return;
  await 말('어림잡은 위치는 <b>지도에서 한 번 더</b> 눌러 확정합니다', 'key', 700);
  await 누르기('.mmap', { 앞: 450, 뒤: 1300, fx: 0.38, fy: 0.36 });
};

/* 배경지도가 실제로 그려졌는지 셉니다 — 개발 자리에서는 0 이 정상입니다.
   오래 기다리면 그 자리가 정지 화면이 됩니다(러너에서는 1~2초면 옵니다). */
let 타일 = 0;
const 타일기다리기 = async (최대 = 4000) => {
  const 끝 = Date.now() + 최대;
  while (Date.now() < 끝) {
    타일 = await 앱().evaluate(() => document.querySelectorAll('svg image[data-t]').length);
    if (타일 > 0) break;
    await 잠깐(400);
  }
  await 잠깐(타일 > 0 ? 900 : 200);
};

/* 카카오맵 화면 — 링크 주소를 **휴대전화 크기 창에서 실제로 열어** 찍습니다.
   누르기 전에 미리 열어 두어(뒤에서) 누르는 순간 기다림 없이 밀어 넣습니다.
   못 열면(인터넷 없음 · 거절) null — 그때는 화면을 넣지 않습니다. */
let 카카오화면 = null;
const 카카오미리 = async (주소) => {
  let c2 = null;
  try {
    c2 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 700 },
      deviceScaleFactor: 2, locale: 'ko-KR' });
    const q = await c2.newPage();
    const 응답 = await q.goto(주소, { waitUntil: 'load', timeout: 20000 });
    await q.waitForTimeout(5000);
    const 글 = await q.evaluate(() => (document.body && document.body.innerText || '').length);
    if (응답 && 응답.status() < 400 && 글 > 20 && /kakao/.test(q.url())) {
      카카오화면 = 'data:image/png;base64,' + (await q.screenshot({ type: 'png' })).toString('base64');
      console.log('  카카오맵 화면을 찍었습니다 — ' + q.url().slice(0, 80));
    } else console.log('  카카오맵을 못 열었습니다 — 화면은 넣지 않습니다');
  } catch (e) { console.log('  카카오맵을 못 열었습니다(' + String(e.message || e).slice(0, 60) + ')'); }
  if (c2) await c2.close().catch(() => {});
};

/* ── 녹화 시작 ─────────────────────────────────────────────── */
await p.goto(`${BASE}/build/${encodeURIComponent('영상무대.html')}`);
await p.evaluate(() => document.fonts.ready);
await 열기('index.html');                    // 표지 뒤에서 진입 화면을 미리 엽니다
await 잠깐(600);

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

/* ══ 0. 이름 · 첫 화면 ══════════════════════════════════════ */
const 표지 = p.evaluate(() => window.무대.표지(4200));
await 잠깐(300);
await 나레이션('여는말1');
await 표지;
await p.evaluate(() => window.무대.머리('시작', '링크 하나로 열립니다', '설치 · 회원가입 없이 — 휴대전화 브라우저에서'));
await 나레이션('여는말2');
await 말('<b>QR</b> 을 비추거나 링크를 누르면 바로 이 화면');
await 나레이션('첫화면');
await 말('<b>01 대피장소 · 02 문자 · 03 방제</b> — 차례대로 해 봅니다');
await 말다하기();
await 누르기('#tools .pn', { 뒤: 200 });

/* ══ 1. 01 주민 대피장소 찾기 ═════════════════════════════ */
const 미션1 = p.evaluate(() => window.무대.미션(1, '주민을 어디로 피하게 하지?', '01 주민 대피장소 찾기'));
await 나레이션('대피_시작');
await 미션1;
await 나레이션('대피_주소');
await 말('사고 위치를 <b>주소</b>로 넣고');
await 치기('#mAddrQ', '여수시 주삼동', 110);
await 잠깐(800);
await 누르기('#addrPop .mpk-row', { 뒤: 1200 });
await 지도확정();
await 타일기다리기();
await 맨위로();
await 나레이션('대피_요약');
await 말('가장 가까운 곳과 <b>반경별 개수</b>가 한 줄로', '', 500);
await 크게('#mSum', 1.75, 2800);
await 나레이션('대피_층');
await 말('<b>화학사고 대피장소</b> · <b>이재민 임시주거시설</b> 나눠 보기', '', 500);
await 크게('#mLayers', 1.6, 2600);
await 말다하기();
await 나레이션('대피_경로');
await 말('대피장소를 고르면 <b>가는 길</b>이 지도에', '', 500);
await 목록으로();
/* 맨 위 줄 = 가장 가까운 **화학사고 대피장소**(여천초등학교). 이재민 임시주거시설을
   고르면 "실제 대피는 그쪽으로"처럼 읽힐 수 있어 화학사고 대피장소를 고릅니다(7절). */
const 고른대피 = 앱().locator('#shList .ms-it').first();
await 누르기(고른대피, { 뒤: 900 });
const 카카오주소 = await 앱().locator('#shList .ms-it.on .shmap-ext a').first().getAttribute('href').catch(() => null);
const 카카오준비 = 카카오주소 ? 카카오미리(카카오주소) : Promise.resolve();
await 잠깐(1200);                              // 도보 경로를 받아 오는 시간
await 맨위로(800);
await 누르기('#zIn', { 뒤: 700 });              // 길이 잘 보이게 지도를 두 번 확대
await 누르기('#zIn', { 뒤: 900 });
await 크게('.mmap', 1.32, 3000);
await 나레이션('대피_카카오');
await 말('<b>카카오맵</b>으로 이어서 확인', '', 400);
await 카카오준비;
const 카카오링크 = 앱().locator('#shList .ms-it.on .shmap-ext a').first();
if (await 카카오링크.count()) {
  await 보이게(카카오링크);
  const 팝업 = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await 누르기(카카오링크, { 뒤: 200 });
  const 새창 = await 팝업;
  if (새창) await 새창.close().catch(() => {});  // 실제 창은 닫고, 찍어 둔 화면을 밀어 넣습니다
  if (카카오화면) {
    await p.evaluate((src) => window.무대.바깥화면(src), 카카오화면);
    await 잠깐(3800);
    await p.evaluate(() => window.무대.바깥닫기());
    await 잠깐(700);
  } else {
    await 말('카카오맵이 <b>새 창</b>으로 열립니다', '', 1800);
  }
} else 문제.push('카카오맵 링크를 못 찾음');
await 말다하기();
await 말('어디로 보낼지는 <b>담당자가 정합니다</b> — 서비스는 자료를 모아 보여 줄 뿐', 'key', 2600);
await 나레이션('대피_넘기기');
await 말('고른 곳을 <b>문자로 바로</b> 넘깁니다', '', 600);
await 보이게(찾기('#btnToSms'));
await p.evaluate(() => window.무대.완료(1, '가까운 대피장소 · 가는 길 · 카카오맵'));
await 말다하기();
await 누르기('#btnToSms', { 뒤: 300 });

/* ══ 2. 02 주민대피 문자생성기 ═════════════════════════════ */
const 미션2 = p.evaluate(() => window.무대.미션(2, '주민에게 알려야 한다', '02 주민대피 문자생성기'));
await 나레이션('문자_시작');
await 미션2;
await 나레이션('문자_미리');
await 말('지역 · 대피장소가 <b>미리 채워져</b> 넘어옵니다', '', 500);
if (await 앱().locator('#seedBar:not([hidden])').count()) await 크게('#seedBar', 1.55, 2600);
await 나레이션('문자_고르기');
await 말('보낼 알림 — <b>주민소산(대피명령)</b>', '', 500);
await 누르기('#stages button[data-s=evac]', { 뒤: 1000 });
const 다음 = () => 누르기('#stepNav .sn-next', { 앞: 260, 뒤: 850 });
await 말('<b>한 화면에 한 가지씩</b> 채웁니다', '', 400);
await 나레이션('문자_채우기');
await 누르기('#types button[data-t="누출"]', { 뒤: 500 });
await 다음();
await 치기('#if_기관', '여수시');
await 누르기('#if_시각', { 뒤: 200 });
await 찾기('#if_시각').fill('14:20');
await 잠깐(400);
await 다음();
if (!(await 찾기('#if_시군').inputValue().catch(() => ''))) await 치기('#if_시군', '여수시');
await 치기('#if_읍면동', '주삼동');
await 치기('#if_사업장', '○○화학', 120);
await 다음();
await 치기('#if_대상지역', '주삼동 일원');
await 다음();
await 나레이션('문자_물질');
await 말('사고물질은 목록에서 — <b>암모니아</b>', '', 300);
await 치기('#if_물질', '암모니아', 140);
await 잠깐(700);
const 물질줄 = 앱().locator('.mpk-row', { hasText: '암모니아' }).first();
await 누르기((await 물질줄.count()) ? 물질줄 : 앱().locator('.mpk-row').first(), { 뒤: 800 });
await 다음();
await 말('대피장소는 <b>앞에서 고른 곳</b>이 그대로', '', 1600);
await 다음();
await 맨위로(500);
await 말다하기();
await 나레이션('문자_문안');
await 말('승인받은 <b>표준문안</b> 그대로 — 글자수까지', '', 400);
await 크게('#out .out:not(.bad) .msg', 1.5, 4200);
await 나레이션('문자_복사');
await 말('<b>복사</b>해서 문자 발송시스템에 붙이면 끝', '', 300);
await 누르기('#out .out:not(.bad) footer button.p', { 뒤: 1300 });
await p.evaluate(() => window.무대.완료(2, '승인받은 표준문안 · 글자수 확인 · 복사'));
await 말다하기();

/* ══ 3. 03 방제 물품·장비 찾기 — 업체 섭외 · 방제물품 둘 다 ═══ */
const 미션3 = p.evaluate(() => window.무대.미션(3, '방제 자원, 어디에 있지?', '03 방제 물품·장비 찾기'));
await 잠깐(500);
await 앱().evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
await 열기('res/index.html');
await 나레이션('방제_시작');
await 미션3;
await 나레이션('방제_업체');
await 말('<b>업체 섭외</b> — 폐기물을 맡길 곳', '', 400);
await 누르기('.rz-br >> nth=0', { 뒤: 800 });
await 누르기(앱().locator('.rz-need', { hasText: '수집·운반' }).first(), { 뒤: 500 });
await 누르기('#rzNext', { 뒤: 800 });
await 말다하기();
await 나레이션('방제_내위치');
await 말('현장이라면 — <b>지금 내가 있는 곳</b>', '', 400);
await 누르기('#startMe', { 뒤: 1500 });
await 지도확정();
await 타일기다리기();
await 맨위로();
await 말다하기();
await 나레이션('방제_업체결과');
await 말('미리 협의된 업체가 <b>맨 위</b>에 — 이름 · 번호는 가렸습니다', '', 300);
await 목록으로();
if (await 앱().locator('#shList .ms-it .tag.first').count()) {
  await 크게(앱().locator('#shList .ms-it').filter({ has: 앱().locator('.tag.first') }).first(), 1.45, 2800);
} else await 굴리기(240, 1600);
await 말다하기();
/* 갈래를 바꿉니다 — 방제 화면을 처음부터 다시 엽니다(결과 화면의 '조건 바꾸기'는
   같은 갈래 안의 거르개라 업체 ↔ 물품을 오가지 않습니다). */
await 앱().evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
await 열기('res/index.html');
await 잠깐(900);
await 나레이션('방제_물품');
await 말('이번에는 <b>방제물품 찾기</b> — 흡착포', '', 400);
await 누르기('.rz-br >> nth=1', { 뒤: 800 });
await 누르기(앱().locator('.rz-item', { hasText: '흡착포' }).first(), { 뒤: 500 });
await 누르기('#rzNext', { 뒤: 800 });
await 누르기('#startMe', { 뒤: 1500 });
await 지도확정();
await 타일기다리기();
await 맨위로();
await 말다하기();
await 나레이션('방제_물품결과');
await 말('가진 곳 · 거리 · <b>보유 수량</b>까지 한눈에', '', 300);
await 목록으로();
await 굴리기(220, 1500);
await 말다하기();
await 나레이션('방제_세부');
await 말('누르면 <b>연락처 · 보유 물품</b>이 한 창에', '', 300);
await 누르기(앱().locator('#shList .ms-it').first(), { 뒤: 1300 });
await 크게('.rkd-items', 1.45, 3000);
await 누르기('.rkd-close', { 뒤: 500 });
await p.evaluate(() => window.무대.완료(3, '업체 섭외 · 방제물품 · 연락처와 수량'));
await 말다하기();

/* ══ 4. 마무리 ═════════════════════════════════════════════ */
const 마무리 = p.evaluate(() => window.무대.마무리());
await 잠깐(300);
await 나레이션('맺음1');
await 나레이션('맺음2');
await 잠깐(1500);
await 나레이션('맺음3');
await 마무리;
await 말다하기(900);

await cdp.send('Page.stopScreencast');
const 끝 = Date.now();
await ctx.close();
await browser.close();
서버.close();

/* ── 받은 장면을 받은 시각대로 이어 붙입니다 ───────────────────── */
if (시각들.length < 30) { console.error('⚠ 받은 장면이 너무 적습니다: ' + 시각들.length); process.exit(1); }
const t0 = 시각들[0];
const 마지막 = t0 + (끝 - 시작) / 1000;
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
const 무음 = `${작업방}/화면.mp4`;
console.log(`장면 ${시각들.length}장 · ${((끝 - 시작) / 1000).toFixed(1)}초 — mp4 로 굽는 중 (preset ${프리셋})`);
execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
  '-i', `${작업방}/목록.ffconcat`, '-vf', 'fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 프리셋, '-crf', process.env.FFCRF || '23',
  '-movflags', '+faststart', '-an', 무음], { stdio: ['ignore', 'inherit', 'inherit'] });
const 초 = (f) => +String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout || 0);
const 영상길이 = 초(무음);

/* ── 소리 — 배경음악 + 나레이션 ────────────────────────────────
   음악은 작게(-14dB) 깔고, 말할 때는 더 낮춥니다(사이드체인 압축 — 목소리가
   나오면 음악이 저절로 물러남). 마지막에 방송 크기(-16 LUFS)로 맞춥니다. */
const 음악 = `${소리방}/음악.wav`;
mkdirSync(소리방, { recursive: true });
const 음악됨 = spawnSync(process.env.PYTHON || 'python3', [`${RPATH}/build/make_music.py`,
  String(Math.ceil(영상길이) + 1), 음악], { stdio: 'inherit' }).status === 0 && existsSync(음악);
const 넣을말 = 소리있음 ? 말한것 : [];
const 입력 = ['-i', 무음];
let 필터 = '';
if (음악됨) { 입력.push('-i', 음악); }
넣을말.forEach((m) => 입력.push('-i', `${소리방}/${m.k}.wav`));
const 첫말 = 음악됨 ? 2 : 1;
넣을말.forEach((m, i) => {
  const ms = Math.max(0, Math.round((m.t - t0) * 1000));
  필터 += `[${첫말 + i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=delays=${ms}:all=1[v${i}];`;
});
let 소리 = null;
if (넣을말.length && 음악됨) {
  필터 += 넣을말.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${넣을말.length}:normalize=0[voice];`
    + '[voice]asplit[vA][vB];'
    + '[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.2[m];'
    + '[m][vA]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=450[md];'
    + '[md][vB]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]';
  소리 = '[a]';
} else if (넣을말.length) {
  필터 += 넣을말.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${넣을말.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
  소리 = '[a]';
} else if (음악됨) {
  필터 += '[1:a]volume=0.35,loudnorm=I=-20:TP=-2[a]';
  소리 = '[a]';
}
if (소리) {
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', ...입력, '-filter_complex', 필터,
    '-map', '0:v', '-map', 소리, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
    '-movflags', '+faststart', 낼], { stdio: ['ignore', 'inherit', 'inherit'] });
} else {
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', 무음, '-c', 'copy', 낼]);
  문제.push('소리를 넣지 못했습니다(음악·나레이션 둘 다 없음)');
}
rmSync(작업방, { recursive: true, force: true });

const 길이 = 초(낼);
const 크기 = readFileSync(낼).length / 1024 / 1024;
console.log(`docs/공모전_시연영상.mp4  ${Math.floor(길이 / 60)}분 ${Math.round(길이 % 60)}초 · ${크기.toFixed(1)}MB`
  + ` · 소리: ${소리있음 ? '나레이션 ' + 넣을말.length + '줄' : '나레이션 없음'}${음악됨 ? ' + 배경음악' : ''}`);
console.log(타일 > 0 ? `  배경지도 타일 ${타일}장 — 도로·건물이 나옵니다`
                    : '  배경지도 타일 없음 — 경계선만(개발 자리에서는 정상)');
console.log(카카오화면 ? '  카카오맵 화면을 넣었습니다' : '  카카오맵 화면 없음(못 열었음 — 자막만)');
if (길이 > 300) 문제.push(`영상이 ${길이.toFixed(0)}초 — 5분(300초)을 넘습니다`);
if (문제.length) {
  console.error('\n⚠ 고칠 것');
  [...new Set(문제)].forEach((m) => console.error('  · ' + m));
  process.exitCode = 1;
}
