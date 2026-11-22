/* 결선 30초 영상 「줌인 판 2」의 03 장면 — 「안전원 상황실로 바로 전화」를 실제로 눌러 녹화합니다
   ───────────────────────────────────────────────────────────────
       node build/record_res_call.mjs [--사이트 폴더]
         → source/녹화/상황실_원본.mp4 · 상황실_원본.json

   ── 왜 따로 녹화하나 (2026-11-22 사용자) ─────────────────────────
   "방제 물품 찾는 장면에서 우리가 제일 마지막에 집어넣었던 그 상황실로 바로 전화를 할 수
   있는 기능이 … 시연 화면에 표현이 될 수 있었으면". 줌인 판(make_short_video_zoom.mjs)의
   시연 화면은 11-09 에 구운 공모전 시연영상에서 잘라 쓰는데, 그 기능은 11-18 에 들어가
   그 영상에 없습니다. 그래서 03 장면만 새로 녹화합니다.

   ── 어느 코드로 녹화하나 ──────────────────────────────────────
   그 기능(미리 협의된 곳의 「비상연락망(휴대전화) ▶ 안전원 상황실 043-830-4120」 — 누르면
   tel: 로 바로 걸림)은 **다른 작업 가지의 커밋 a869d46** 에만 있고 이 가지에는 아직 없습니다.
   그 커밋을 따로 꺼낸 폴더를 `--사이트` 로 받아 그 화면을 녹화합니다(기본은 이 저장소 — 그러면
   상황실 줄이 없어 멈춥니다).
       git worktree add --detach .narr/상황실판 a869d46
       node build/record_res_call.mjs --사이트 .narr/상황실판
   쓰는 구간은 목록뿐이라 배경지도가 화면에 없습니다 — 그래서 개발 자리에서 녹화해도 됩니다
   (흐름 판처럼 액션까지 갈 필요가 없음). 녹화 파일도 그 구간만 남깁니다(목록으로 내려가는 때부터).

   ── 지키는 것 ─────────────────────────────────────────────────
   · 휴대전화 안은 **실제 서비스**입니다. 누른 뒤 걸리는 전화 화면은 기기마다 달라 그리지
     않습니다 — 대신 그 링크가 실제로 tel:0438304120 인지 녹화하면서 확인합니다(아니면 멈춤).
     녹화 브라우저에는 전화가 없어 누른 링크가 아무 데로도 안 가게만 막습니다(화면은 그대로).
   · 업체명·전화번호는 흐립니다(흐름 판 make_short_video_flow.mjs 와 같은 규칙).
     **안전원 상황실 번호만은 흐리지 않습니다** — 이 장면이 보여 주려는 것이 그 번호이고,
     업체·담당자 번호가 아니라 화학물질안전원 상황실의 번호입니다(사용자가 서비스에 넣은 그대로).
   · 사고지점은 흐름 판과 같은 가상 자리(여수시 주삼동 · `사고`), 갈래는 업체 섭외 → 수집·운반.
   · 화면 크기는 390×743 — 줌인 판의 다른 시연 화면(공모전 시연영상에서 자른 506×964)과 같은
     비율이라 휴대전화 틀에 그대로 맞습니다. 2배로 키운 틀에서 받습니다(흐름 판과 같은 까닭).
   ─────────────────────────────────────────────────────────── */
import { chromium, devices } from 'playwright';
import http from 'http';
import path from 'path';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const RPATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 사이트인자 = process.argv.indexOf('--사이트');
const 사이트 = 사이트인자 > 0 ? path.resolve(process.argv[사이트인자 + 1]) : RPATH;
const 원본방 = path.join(RPATH, 'source/녹화');
const 원본영상 = path.join(원본방, '상황실_원본.mp4');
const 원본표 = path.join(원본방, '상황실_원본.json');
const ff = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const 화면 = { width: 390, height: Math.round(390 * 964 / 506) };   // 390×743
const 틀 = 2;
const 상황실번호 = 'tel:0438304120';
const 사고 = { lat: 34.789275, lon: 127.652015 };          // 흐름 판과 같은 가상 사고지점
const 거리m = (a, b) => {
  const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
};

const 작업방 = path.join(RPATH, '.narr/상황실녹화');
rmSync(작업방, { recursive: true, force: true });
mkdirSync(작업방, { recursive: true });
mkdirSync(원본방, { recursive: true });

const 종류 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const W = 화면.width * 틀, H = 화면.height * 틀;
const 틀HTML = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${H}px;`
  + `overflow:hidden;background:#fff}iframe{border:0;width:${화면.width}px;height:${화면.height}px;transform:scale(${틀});`
  + 'transform-origin:0 0;display:block}</style><iframe name="app" src="/res/index.html"></iframe>';
const 서버 = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/__틀.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(틀HTML); }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(사이트, path.normalize(u));
  if (!f.startsWith(사이트) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 종류[path.extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(r);
});
await new Promise((ok) => 서버.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${서버.address().port}`;

const browser = await chromium.launch({ args: ['--lang=ko-KR'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true,
  userAgent: devices['iPhone 13'].userAgent, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block',
});
/* 가리기 — 흐름 판과 같은 규칙에 상황실 번호만 예외. 누른 tel: 링크는 어디로도 안 가게 막고
   무엇을 눌렀는지 적어 둡니다(녹화가 그것으로 확인). */
await ctx.addInitScript(() => {
  if (window.top === window) return;
  const 붙이기 = () => {
    if (!document.head) return setTimeout(붙이기, 20);
    const s = document.createElement('style');
    s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
      + 'a[href^="tel:"],.rs-num,.rkd-tel,.rkd-tel2{filter:blur(7px)!important}'
      + '.rk-emg a.rk-emg-tel{filter:none!important}'
      + '.__가림{filter:blur(6px)!important;font-style:normal}'
      + '.ms-it .l1 b,.rkd header b,.mnear-it b,#mAddr b,.mob-it{filter:blur(6px)!important}'
      + 'svg text.mkl{display:none!important}';
    document.head.appendChild(s);
  };
  붙이기();
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a) { e.preventDefault(); window.__누른전화 = a.getAttribute('href'); }
  }, true);
  const 번호꼴 = /0\d{1,2}-\d{3,4}-\d{4}|1[5-9]\d{2}-\d{4}/g;
  const 번호가림 = (뿌리) => {
    if (!뿌리 || !document.body) return;
    const 걸음 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
    const 고칠것 = [];
    for (let n = 걸음.nextNode(); n; n = 걸음.nextNode()) {
      const 위 = n.parentNode;
      if (!위 || 위.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      if (/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(위.nodeName) || 위.classList.contains('__번호')) continue;
      if (위.closest('.rk-emg-tel')) continue;                // 안전원 상황실 번호는 그대로
      번호꼴.lastIndex = 0;
      if (번호꼴.test(n.textContent)) 고칠것.push(n);
    }
    고칠것.forEach((n) => {
      if (!n.parentNode) return;
      const 조각 = document.createDocumentFragment();
      let 끝 = 0;
      n.textContent.replace(번호꼴, (m, at) => {
        if (at > 끝) 조각.appendChild(document.createTextNode(n.textContent.slice(끝, at)));
        const i = document.createElement('i');
        i.className = '__번호'; i.textContent = m;
        i.style.cssText = 'filter:blur(7px);font-style:normal';
        조각.appendChild(i);
        끝 = at + m.length;
        return m;
      });
      if (끝 < n.textContent.length) 조각.appendChild(document.createTextNode(n.textContent.slice(끝)));
      n.parentNode.replaceChild(조각, n);
    });
  };
  const 목록가림 = () => document.querySelectorAll('#addrPop .mpk-row').forEach((r) => {
    const en = r.querySelector('.en'), nm = r.querySelector('.nm');
    if (nm && en && !/^(시·군·구|읍·면·동|시·도)$/.test(en.textContent.trim())) nm.classList.add('__가림');
  });
  const 감싸기 = () => document.querySelectorAll('.ms-near').forEach((el) => {
    [...el.childNodes].forEach((n) => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const i = document.createElement('i');
      i.className = '__가림'; i.textContent = n.textContent;
      el.replaceChild(i, n);
    });
  });
  new MutationObserver((목록) => {
    목록.forEach((m) => {
      if (m.type === 'characterData') 번호가림(m.target.parentNode);
      else m.addedNodes.forEach((n) => 번호가림(n.nodeType === 3 ? n.parentNode : n));
    });
    목록가림();
    감싸기();
  }).observe(document, { childList: true, subtree: true, characterData: true });
});

const p = await ctx.newPage();
const 문제 = [];
p.on('pageerror', (e) => 문제.push('화면 오류: ' + e.message));
const cdp = await ctx.newCDPSession(p);
const 시각들 = [];
cdp.on('Page.screencastFrame', (f) => {
  const i = 시각들.length;
  writeFileSync(path.join(작업방, `f${String(i).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64'));
  시각들.push(f.metadata && f.metadata.timestamp ? f.metadata.timestamp : Date.now() / 1000);
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const 표 = [], 누름 = [];
const 표시 = (k, 덧 = {}) => { 표.push({ k, t: Date.now() / 1000, ...덧 }); };
const 앱 = () => p.frame({ name: 'app' });
const 자리 = async (loc) => {
  const b = await loc.boundingBox().catch(() => null);
  return b ? { x: b.x / 틀, y: b.y / 틀, w: b.width / 틀, h: b.height / 틀 } : null;
};
const 잠깐 = (ms) => p.waitForTimeout(ms);
const 찾기 = (대상) => (typeof 대상 === 'string' ? 앱().locator(대상).first() : 대상);
const 톡 = async (x, y, { 앞 = 260, 뒤 = 700, 표: 이름 } = {}) => {
  await 잠깐(앞);
  if (이름) 표시(이름);
  누름.push({ t: Date.now() / 1000, x, y });
  await p.touchscreen.tap(x * 틀, y * 틀);
  await 잠깐(뒤);
};
const 누르기 = async (대상, 덧 = {}) => {
  const loc = 찾기(대상);
  try { await loc.waitFor({ state: 'visible', timeout: 9000 }); }
  catch (e) { 문제.push('못 찾음: ' + 대상); return false; }
  const 안 = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= innerHeight - 60;
  }).catch(() => true);
  if (!안) { await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' })); await 잠깐(650); }
  const b = await loc.boundingBox();
  if (!b) { 문제.push('자리 없음: ' + 대상); return false; }
  await 톡((b.x + b.width / 2) / 틀, (b.y + b.height / 2) / 틀, 덧);
  return true;
};
const 치기 = async (칸, 값, 속도 = 110) => {
  if (!(await 누르기(칸, { 뒤: 250 }))) return false;
  await 찾기(칸).pressSequentially(값, { delay: 속도 });
  await 잠깐(450);
  return true;
};
let 타일 = 0;
const 타일기다리기 = async (최대 = 4000) => {
  const 끝 = Date.now() + 최대;
  while (Date.now() < 끝) {
    타일 = await 앱().evaluate(() => document.querySelectorAll('svg image[data-t]').length);
    if (타일 > 0) break;
    await 잠깐(300);
  }
  await 잠깐(타일 > 0 ? 600 : 150);
};
/* 사고지점 찍기 — 흐름 판과 같은 셈(주삼동 방제자원 자리의 가운데에서 축척 막대로 px 를 셈) */
const 동가운데 = () => 앱().evaluate(() => {
  const 맞음 = (a) => {
    a = String(a || '');
    const m1 = /(?:^|\s)([가-힣0-9]+(?:읍|면|동))(?:\s|$)/.exec(a), m2 = /\(([가-힣0-9]+(?:동|리|가))\)/.exec(a);
    return (m1 && m1[1] === '주삼동') || (m2 && m2[1] === '주삼동');
  };
  let sx = 0, sy = 0, n = 0;
  const P = window.RES2_PLACE, 줄 = Array.isArray(P) ? P : Object.values(P);
  줄.forEach((r) => { if (r.sg === '여수시' && r.la != null && 맞음(r.a)) { sx += r.lo; sy += r.la; n++; } });
  return n ? { lat: sy / n, lon: sx / n } : null;
});
const 사고찍기 = async (C) => {
  if (!C) { 문제.push('주삼동 가운데를 셀 수 없음'); return; }
  await 앱().evaluate(() => document.querySelector('.mmap').scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await 잠깐(700);
  const g = await 앱().evaluate(() => {
    const r = document.querySelector('.mmap').getBoundingClientRect();
    const bar = document.querySelector('#scaleBar').getBoundingClientRect().width;
    const m = /([\d.]+)\s*(k?m)/.exec(document.querySelector('#scaleTxt').textContent || '');
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, mpp: m && bar ? (+m[1] * (m[2] === 'km' ? 1000 : 1)) / bar : null };
  });
  if (!g.mpp) { 문제.push('축척을 못 읽음'); return; }
  const dx = (사고.lon - C.lon) * 111320 * Math.cos(C.lat * Math.PI / 180) / g.mpp;
  const dy = -(사고.lat - C.lat) * 110574 / g.mpp;
  await 톡(g.cx + dx, g.cy + dy, { 앞: 450, 뒤: 1000 });
};

await p.goto(`${BASE}/__틀.html`, { waitUntil: 'load' });
await 앱().waitForLoadState('load');
await 앱().evaluate(() => document.fonts.ready);
await 잠깐(600);
await 누르기('.rz-br >> nth=0', { 뒤: 650 });                                  // 업체 섭외
await 누르기(앱().locator('.rz-need', { hasText: '수집·운반' }).first(), { 뒤: 450 });
await 누르기('#rzNext', { 뒤: 650 });
await 치기('#startQ', '주삼동');
await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 900 });
await 타일기다리기();
await 사고찍기(await 동가운데());
const 찍힘 = await 앱().evaluate(() => [document.querySelector('#acLat'), document.querySelector('#acLon')]
  .map((e) => (e ? parseFloat(e.value) : NaN)));
if (!isFinite(찍힘[0]) || 거리m({ lat: 찍힘[0], lon: 찍힘[1] }, 사고) > 60) 문제.push('사고지점이 어긋남: ' + 찍힘);
await 타일기다리기(2500);
/* 여기서부터 받습니다 — 앞의 고르기·찍기는 영상에 안 쓰여 파일만 키웁니다 */
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H });
const 시작 = Date.now();
await 잠깐(500);
표시('찍음');

/* 목록으로 — 「아래로 내려 목록 보기」 를 눌러 내려감(사람이 하는 그대로) */
if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 1000, 표: '목록으로' });
else { 표시('목록으로'); await 앱().evaluate(() => document.querySelector('#shList').scrollIntoView({ block: 'start', behavior: 'smooth' })); await 잠깐(1000); }
const 첫줄 = 앱().locator('#shList .ms-it').first();
const 전화 = 첫줄.locator('.rk-emg a.rk-emg-tel').first();
if (!(await 첫줄.locator('.tag.first').count())) 문제.push('미리 협의된 곳이 맨 위가 아님');
if (!(await 전화.count())) {
  문제.push('맨 위 줄에 「안전원 상황실」 전화 링크가 없음 — --사이트 로 그 기능이 있는 커밋(a869d46)을 주세요');
} else {
  /* 「목록 보기」 로 내려온 자리 그대로 둡니다 — 맨 위 줄(초록 딱지 · 상황실 줄)이 화면 위쪽에
     옵니다. 더 움직이면 3초 남짓한 장면에서 눈이 따라가지 못합니다. */
  if (!(await 전화.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top > 56 && r.bottom < innerHeight - 90; })))
    문제.push('상황실 줄이 화면 밖에 있음');
  const 줄머리 = await 자리(첫줄.locator('.l0').first());
  const 링크 = await 자리(전화);
  표시('목록', { 줄머리, 링크, 글: (await 첫줄.locator('.rk-emg').innerText()).replace(/\s+/g, ' ') });
  await 잠깐(1000);
  await 누르기(전화, { 앞: 200, 뒤: 300, 표: '전화' });
  const 눌린 = await 앱().evaluate(() => window.__누른전화 || '');
  if (눌린 !== 상황실번호) 문제.push(`누른 링크가 상황실 번호가 아님: "${눌린}"`);
  if (await 앱().locator('#shList .ms-it.on').count()) 문제.push('링크를 눌렀는데 줄 고르기가 함께 일어남');
  표시('전화후', { 링크: await 자리(전화), 눌린 });
  await 잠깐(2200);
}
표시('끝');
await cdp.send('Page.stopScreencast');
const 끝 = Date.now();
await ctx.close();
await browser.close();
서버.close();


if (시각들.length < 30) { console.error('⚠ 받은 장면이 너무 적습니다: ' + 시각들.length); process.exit(1); }
const t0 = 시각들[0];
const 마지막 = t0 + (끝 - 시작) / 1000;
let 목록 = 'ffconcat version 1.0\n';
for (let i = 0; i < 시각들.length; i++) {
  const 다음시각 = i + 1 < 시각들.length ? 시각들[i + 1] : Math.max(마지막, 시각들[i] + 0.5);
  목록 += `file 'f${String(i).padStart(6, '0')}.jpg'\nduration ${Math.max(0.001, 다음시각 - 시각들[i]).toFixed(4)}\n`;
}
목록 += `file 'f${String(시각들.length - 1).padStart(6, '0')}.jpg'\n`;
writeFileSync(path.join(작업방, '목록.ffconcat'), 목록);
execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
  '-i', path.join(작업방, '목록.ffconcat'), '-vf', `fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', 원본영상]);
const 상대 = (t) => +(t - t0).toFixed(3);
const 기록 = {
  설명: '03 「안전원 상황실로 바로 전화」 녹화본의 장면 시각(초 · 영상의 0초 기준). record_res_call.mjs 가 씁니다.',
  녹화한날: new Date().toISOString(), 화면, 배경지도타일: 타일, 사이트: path.relative(RPATH, 사이트) || '.',
  사고, 표: 표.map((m) => ({ ...m, t: 상대(m.t) })), 누름: 누름.map((m) => ({ ...m, t: 상대(m.t) })), 문제,
};
writeFileSync(원본표, JSON.stringify(기록, null, 1));
console.log(`녹화 ${((끝 - 시작) / 1000).toFixed(1)}초 · 장면 ${시각들.length}장 · 배경지도 타일 ${타일}장`);
for (const m of 기록.표) console.log(`  ${String(m.t.toFixed(2)).padStart(6)}  ${m.k}${m.글 ? ' — ' + m.글 : ''}`);
if (문제.length) { console.error('⚠ 고칠 것\n  ' + 문제.join('\n  ')); process.exit(1); }
