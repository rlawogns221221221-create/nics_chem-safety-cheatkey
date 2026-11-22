/* 결선 발표용 30초대 영상 「사고 하나 흐름 판」 — 녹화 · 조립
   ───────────────────────────────────────────────────────────────
       node build/make_short_video_flow.mjs 녹화   # 휴대전화 화면을 녹화 → source/녹화/흐름_원본.*
       node build/make_short_video_flow.mjs 엮기   # 녹화본에 자막·타이머를 얹어 → docs/공모전_결선_30초_흐름.mp4
       node build/make_short_video_flow.mjs 둘다

   ── 무엇을 보여 주나 (2026-11-22 요청문) ──────────────────────────
   결선 발표(5분) 중에 트는 30초대 영상입니다. 첫 판(make_short_video.mjs)·줌인 판
   (make_short_video_zoom.mjs)과 달리 **사고 하나를 처음부터 끝까지** 실제로 눌러 갑니다.
   가상 상황: 여수시 주삼동 사업장 암모니아 누출.
     ① QR 로 접속 → 첫 화면
     ② 03 방제 물품·장비 찾기 — 주소 입력 → 거리순 목록 → 미리 협의된 업체가 맨 위 → 동원 목록에 담기
     ③ 04 현장 안전거리 확인 — 암모니아 · 사고지점 · 구역 → 내 위치가 구역 안인지
     ④ 01 주민 대피장소 찾기(04 의 사고지점·물질을 그대로 받음) → 02 주민대피 문자생성기
     ⑤ 마무리 + 접속 QR
   나레이션 없이 큰 자막(한 화면에 한 문장)과 오른쪽 위 경과 시간 타이머를 둡니다.

   ── 사용자와 정한 것 (2026-11-22) ─────────────────────────────────
   · 03 의 자막은 **화면 표현 그대로** 「미리 협의된 업체가 맨 위에」 — 요청문의 「AI가 매칭한
     협의업체」는 쓰지 않습니다. 맨 위에 오는 것은 허가증까지 확인된 협의업체를 정해진 규칙으로
     올리는 것이고, 제출한 README 에도 「실행 중에는 AI 모델을 부르지 않습니다」라고 적었습니다.
   · 타이머는 **기계가 누른 실제 녹화 시간 그대로**이고 「자동 시연 기준」이라고 밝힙니다.
     빠르게 돌린 구간은 「○배 빠르게」를 함께 띄웁니다 — 타이머는 녹화된 그 장면의 실제
     시각이라 빨리 돌리면 타이머도 그만큼 빨리 갑니다(숫자를 지어내지 않음).
     「3분 이내」는 근거를 확인해 주기 전까지 넣지 않습니다.
   · 차례는 요청문대로 03 → 04 → 01 → 02. **03 의 사고지점은 04 로 넘어가지 않아** 04 에서
     주소를 한 번 더 넣는 장면이 그대로 나옵니다. 그래서 끝 자막에 「입력 한 번」을 쓰지 않습니다.

   ── 지키는 것 ─────────────────────────────────────────────────
   · 휴대전화 안은 **실제 서비스**입니다. 무대는 테두리·자막·타이머·확대만 맡습니다.
   · 업체명·전화번호는 흐리게 가립니다(make_contest_video.mjs 와 같은 방식 · 공개 영상).
   · 사고지점은 03·04 에서 **같은 좌표**(아래 `사고`)를 찍습니다 — 두 화면이 다른 곳을 가리키면
     "한 사고"가 아니게 됩니다. 찍은 뒤 화면의 위도·경도 칸을 읽어 60m 넘게 어긋나면 멈춥니다.
     그 자리는 '주삼동'을 골랐을 때 지도가 옮겨 가는 가운데(그 동 대피장소 자리)에서 서쪽으로
     250m · 북쪽으로 120m — 가운데를 그대로 찍으면 대피장소 바로 위라 「0m」 가 나옵니다.
   · 내 위치는 사고지점에서 **북동쪽 700m**, 바람은 남서풍 — 방호활동 구역이 내 쪽으로 퍼져
     「방호활동 구역 안」 이 나옵니다(04 장면의 '내 위치 판정'). 안 나오면 멈춥니다.

   ── 배경지도 ───────────────────────────────────────────────────
   개발 자리는 타일 서버로 못 나가 지도에 경계선만 나옵니다(CLAUDE.md 6절).
   내는 판은 액션 러너에서 녹화합니다 — .github/workflows/결선영상_흐름_굽기.yml.
   `엮기` 는 녹화본만 있으면 어디서나 돌아갑니다(자막만 고칠 때는 다시 녹화하지 않음).
   ─────────────────────────────────────────────────────────── */
import { chromium, devices } from 'playwright';
import http from 'http';
import path from 'path';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync,
         readFileSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const RPATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 모드 = process.argv[2] || '엮기';
const 원본방 = path.join(RPATH, 'source/녹화');
const 원본영상 = path.join(원본방, '흐름_원본.mp4');
const 원본표 = path.join(원본방, '흐름_원본.json');
const 낼 = path.join(RPATH, 'docs/공모전_결선_30초_흐름.mp4');
const ff = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const 화면 = { width: 390, height: 800 };   // 휴대전화 화면(css px) — 무대의 휴대전화 틀과 같은 비율

/* 가상 사고지점과 근무자 자리 */
const 사고 = { lat: 34.789275, lon: 127.652015 };
const 북동700 = (() => {
  const d = 700 / 6371000, 위 = 사고.lat * Math.PI / 180, b = Math.PI / 4;
  return { latitude: 사고.lat + d * Math.cos(b) * 180 / Math.PI,
           longitude: 사고.lon + d * Math.sin(b) * 180 / Math.PI / Math.cos(위), accuracy: 20 };
})();
const 거리m = (a, b) => {
  const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
};

if (!['녹화', '엮기', '둘다'].includes(모드)) { console.error('쓰는 법: 녹화 | 엮기 | 둘다'); process.exit(2); }
if (모드 === '녹화' || 모드 === '둘다') await 녹화();
if (모드 === '엮기' || 모드 === '둘다') await 엮기();

/* ══════════════════════════════════════════════════════════════
   녹화 — 휴대전화 화면만 받습니다(무대 없이). 장면마다 받은 시각을 적어 두어
   타이머가 **실제 시각**을 띄우게 합니다.
   ══════════════════════════════════════════════════════════════ */
async function 녹화() {
  const 작업방 = path.join(RPATH, '.narr/흐름녹화');
  rmSync(작업방, { recursive: true, force: true });
  mkdirSync(작업방, { recursive: true });
  mkdirSync(원본방, { recursive: true });

  /* 작은 서버 — file:// 은 sessionStorage 가 화면마다 남남이라 도구끼리 넘기기가 안 됩니다 */
  const 종류 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  /* 틀 — 휴대전화 화면(390×800)을 iframe 에 담아 2배로 키워 그립니다. 화면 중계
     (screencast)는 화소 배율(deviceScaleFactor)을 무시하고 css 크기 그대로(390×800) 보내 와
     발표장 큰 화면에서 글씨가 흐렸습니다. 2배로 키운 틀을 780×1600 으로 받으면 또렷합니다.
     ⚠ html·body 를 키운 크기로 잡아야 합니다 — 안 그러면 아래 절반이 잘려 누르기가 안 닿습니다. */
  const 틀HTML = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:780px;height:1600px;'
    + 'overflow:hidden;background:#fff}iframe{border:0;width:390px;height:800px;transform:scale(2);'
    + 'transform-origin:0 0;display:block}</style><iframe name="app" src="/index.html"></iframe>';
  const 서버 = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__틀.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(틀HTML); }
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(RPATH, path.normalize(u));
    if (!f.startsWith(RPATH) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': 종류[path.extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(r);
  });
  await new Promise((ok) => 서버.listen(0, '127.0.0.1', ok));
  const BASE = `http://127.0.0.1:${서버.address().port}`;

  const browser = await chromium.launch({ args: ['--lang=ko-KR'] });
  const ctx = await browser.newContext({
    viewport: { width: 화면.width * 2, height: 화면.height * 2 }, deviceScaleFactor: 1, hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    permissions: ['geolocation'], geolocation: 북동700, serviceWorkers: 'block',
  });
  /* 가리기 — make_contest_video.mjs 와 같은 규칙(그 파일의 설명 참고).
     ① 녹화 자리에서만 뜨는 띠(배경지도 경고 · 인터넷 검색 불가 줄)를 가립니다.
     ② 전화번호는 어느 화면이든 글자 꼴로 찾아 흐리고, 업체명은 방제(③) 화면에서 흐립니다.
     ③ 주소 찾기 목록의 업체·사업장 줄(시·군·구 · 읍·면·동이 아닌 줄)은 이름을 흐립니다 —
        '주삼동'을 치면 그 동에 있는 실제 업체 이름이 함께 뜹니다. */
  await ctx.addInitScript(() => {
    if (window.top === window) return;                 // 틀에는 붙이지 않음
    const 방제 = /\/res\//.test(location.pathname);
    const 붙이기 = () => {
      if (!document.head) return setTimeout(붙이기, 20);
      const s = document.createElement('style');
      s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
        + 'a[href^="tel:"],.rs-num,.rkd-tel,.rkd-tel2{filter:blur(7px)!important}'
        + '.__가림{filter:blur(6px)!important;font-style:normal}'
        + (방제 ? '.ms-it .l1 b,.rkd header b,.mnear-it b,#mAddr b,.mob-it{filter:blur(6px)!important}'
                + 'svg text.mkl{display:none!important}' : '');
      document.head.appendChild(s);
    };
    붙이기();
    const 번호꼴 = /0\d{1,2}-\d{3,4}-\d{4}|1[5-9]\d{2}-\d{4}/g;
    const 번호가림 = (뿌리) => {
      if (!뿌리 || !document.body) return;
      const 걸음 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
      const 고칠것 = [];
      for (let n = 걸음.nextNode(); n; n = 걸음.nextNode()) {
        const 위 = n.parentNode;
        if (!위 || 위.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
        if (/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(위.nodeName) || 위.classList.contains('__번호')) continue;
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
      if (방제) 감싸기();
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  const p = await ctx.newPage();
  const 문제 = [];
  p.on('pageerror', (e) => 문제.push('화면 오류: ' + e.message));

  /* ── 받은 장면 · 표시 ── */
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
  const 틀 = 2;                                         // 틀 px = 휴대전화 css px × 2
  const 앱 = () => p.frame({ name: 'app' });
  const 자리 = async (sel) => {                         // 휴대전화 css px 로
    const l = typeof sel === 'string' ? 앱().locator(sel).first() : sel;
    const b = await l.boundingBox().catch(() => null);
    return b ? { x: b.x / 틀, y: b.y / 틀, w: b.width / 틀, h: b.height / 틀 } : null;
  };
  const 넘어감 = async (꼴) => {                         // 휴대전화 안 화면이 바뀔 때까지
    await 앱().waitForURL(꼴, { timeout: 20000 });
    await 앱().waitForLoadState('load');
  };

  /* ── 손놀림 — 사람이 쓰는 차례 그대로, 서두르지도 늘이지도 않게 ── */
  const 잠깐 = (ms) => p.waitForTimeout(ms);
  const 찾기 = (대상) => (typeof 대상 === 'string' ? 앱().locator(대상).first() : 대상);
  const 보이게 = async (loc) => {
    const 안 = await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 60 && r.bottom <= innerHeight - 60;
    }).catch(() => true);
    if (!안) {
      await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await 잠깐(650);
    }
  };
  /* 표: 화면을 넘기는 누름이면 그 순간에 표시를 남김 — 장면 경계를 '다음 화면이 그려지는
     때'가 아니라 '누른 때'에 둡니다(그려지는 때로 두면 다음 화면이 앞 장면 자막 아래 먼저 보임) */
  const 톡 = async (x, y, { 앞 = 260, 뒤 = 700, 표: 이름 } = {}) => {
    await 잠깐(앞);
    if (이름) 표시(이름);
    누름.push({ t: Date.now() / 1000, x, y });          // x·y 는 휴대전화 css px
    await p.touchscreen.tap(x * 틀, y * 틀);
    await 잠깐(뒤);
  };
  const 누르기 = async (대상, { 앞 = 260, 뒤 = 700, 표: 이름 } = {}) => {
    const loc = 찾기(대상);
    try { await loc.waitFor({ state: 'visible', timeout: 9000 }); }
    catch (e) { 문제.push('못 찾음: ' + 대상); return false; }
    await 보이게(loc);
    const b = await loc.boundingBox();
    if (!b) { 문제.push('자리 없음: ' + 대상); return false; }
    await 톡((b.x + b.width / 2) / 틀, (b.y + b.height / 2) / 틀, { 앞, 뒤, 표: 이름 });
    return true;
  };
  const 치기 = async (칸, 값, 속도 = 110) => {
    if (!(await 누르기(칸, { 뒤: 250 }))) return false;
    await 찾기(칸).pressSequentially(값, { delay: 속도 });
    await 잠깐(450);
    return true;
  };
  const 맨위로 = async (ms = 600) => {
    await 앱().evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
    await 잠깐(ms);
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
  /* '주삼동'을 고르면 지도가 그 동의 가운데(C)로 옮겨 갑니다. 그 가운데는 앱이 자료에서
     셈하는 값과 같은 식으로 여기서 셉니다(03 = 방제자원 자리 · 04 = 대피장소). 축척 막대로
     1px 이 몇 m 인지 재서 `사고` 자리를 누릅니다 — 확대 정도가 바뀌어도 같은 곳입니다. */
  const 동가운데 = (자료) => 앱().evaluate((자료) => {
    const 맞음 = (a) => {
      a = String(a || '');
      const m1 = /(?:^|\s)([가-힣0-9]+(?:읍|면|동))(?:\s|$)/.exec(a), m2 = /\(([가-힣0-9]+(?:동|리|가))\)/.exec(a);
      return (m1 && m1[1] === '주삼동') || (m2 && m2[1] === '주삼동');
    };
    let sx = 0, sy = 0, n = 0;
    if (자료 === '방제') {
      const P = window.RES2_PLACE, 줄 = Array.isArray(P) ? P : Object.values(P);
      줄.forEach((r) => { if (r.sg === '여수시' && r.la != null && 맞음(r.a)) { sx += r.lo; sy += r.la; n++; } });
    } else {
      (window.SHELTERS['전라남도']['여수시'] || []).forEach((r) => {
        if (r[5] != null && r[6] != null && 맞음(r[2])) { sx += r[6]; sy += r[5]; n++; }
      });
    }
    return n ? { lat: sy / n, lon: sx / n } : null;
  }, 자료);
  const 사고찍기 = async (지도, C) => {
    if (!C) { 문제.push('주삼동 가운데를 셀 수 없음'); return; }
    await 앱().evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'smooth' }), 지도);
    await 잠깐(700);
    const g = await 앱().evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      const bar = document.querySelector('#scaleBar').getBoundingClientRect().width;
      const m = /([\d.]+)\s*(k?m)/.exec(document.querySelector('#scaleTxt').textContent || '');
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, mpp: m && bar ? (+m[1] * (m[2] === 'km' ? 1000 : 1)) / bar : null };
    }, 지도);
    if (!g.mpp) { 문제.push('축척을 못 읽음: ' + 지도); return; }
    const dx = (사고.lon - C.lon) * 111320 * Math.cos(C.lat * Math.PI / 180) / g.mpp;
    const dy = -(사고.lat - C.lat) * 110574 / g.mpp;
    await 톡(g.cx + dx, g.cy + dy, { 앞: 450, 뒤: 1000 });
  };
  const 찍힌자리 = async () => {
    const v = await 앱().evaluate(() => [document.querySelector('#acLat'), document.querySelector('#acLon')]
      .map((e) => (e ? parseFloat(e.value) : NaN)));
    return isFinite(v[0]) && isFinite(v[1]) ? { lat: v[0], lon: v[1] } : null;
  };

  /* ── 녹화 시작 ── */
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 화면.width * 틀, maxHeight: 화면.height * 틀 });
  const 시작 = Date.now();

  /* ① 접속 — 첫 화면 */
  await p.goto(`${BASE}/__틀.html`, { waitUntil: 'load' });
  await 앱().evaluate(() => document.fonts.ready);
  표시('접속');
  await 잠깐(2400);

  /* ② 03 방제 물품·장비 찾기 */
  await 누르기('li.pn a[href*="res/"]', { 뒤: 200, 표: '03누름' });
  await 넘어감(/\/res\//);
  표시('03');
  await 잠깐(500);
  await 누르기('.rz-br >> nth=0', { 뒤: 650 });                                  // 업체 섭외
  await 누르기(앱().locator('.rz-need', { hasText: '수집·운반' }).first(), { 뒤: 450 });
  await 누르기('#rzNext', { 뒤: 650 });
  await 치기('#startQ', '주삼동');
  await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 900 });
  await 타일기다리기();
  await 사고찍기('.mmap', await 동가운데('방제'));
  표시('03찍음');
  const 찍03 = await 찍힌자리();
  if (!찍03 || 거리m(찍03, 사고) > 60) 문제.push('03 사고지점이 어긋남: ' + JSON.stringify(찍03));
  await 타일기다리기(2500);
  if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 900 });
  else { await 보이게(찾기('#shList')); await 잠깐(400); }
  const 협의줄 = 앱().locator('#shList .ms-it').filter({ has: 앱().locator('.tag.first') }).first();
  if (!(await 협의줄.count())) 문제.push('03 — 미리 협의된 업체가 목록에 없음');
  else if ((await 앱().locator('#shList .ms-it').first().locator('.tag.first').count()) === 0)
    문제.push('03 — 미리 협의된 업체가 맨 위가 아님');
  const 협의자리 = await 자리(협의줄);
  if (협의자리) 협의자리.h = Math.min(협의자리.h, 76);        // 머리 두 줄(초록 띠 · 이름 · 거리)만
  표시('03목록', { 자리: 협의자리 });
  await 잠깐(2200);
  await 누르기(협의줄, { 뒤: 1000 });
  표시('03세부', { 자리: await 자리('#rkDet .rkd') || await 자리('#rkDet') });
  await 잠깐(900);
  await 누르기(앱().locator('#rkDet button', { hasText: '동원 목록에 담기' }).first(), { 뒤: 800 });
  if (!(await 앱().locator('#rMob:not([hidden]) .mob-n').count())) 문제.push('03 — 동원 목록에 담기지 않음');
  표시('03담음', { 자리: await 자리('#rMob') });
  await 잠깐(900);

  /* ③ 04 현장 안전거리 확인 — 첫 화면으로 돌아가(휴대전화의 '뒤로') 04 카드를 누름 */
  표시('뒤로');
  await 앱().evaluate(() => history.back());
  await 넘어감(/\/index\.html$/);
  await 잠깐(900);
  await 누르기('li.pn a[href*="safe/"]', { 뒤: 200, 표: '04누름' });
  await 넘어감(/\/safe\//);
  표시('04');
  await 잠깐(500);
  await 치기('#sfMat', '암모니아', 120);
  await 누르기(앱().locator('.mpk:not(#addrPop) .mpk-row', { hasText: '암모니아' }).first(), { 뒤: 600 });
  await 치기('#sfAddr', '주삼동');
  await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 900 });
  await 타일기다리기();
  await 사고찍기('#map', await 동가운데('대피장소'));
  표시('04찍음');
  await 맨위로();
  await 누르기('#segSize button[data-v="l"]', { 뒤: 600 });                    // 대규모
  await 누르기('#windBtn', { 뒤: 700 });
  await 누르기('#windPop .wr-b[data-deg="225"]', { 뒤: 900 });                   // 남서풍
  표시('04구역');
  await 누르기('#btnWatch', { 뒤: 1500 });
  const 판정 = 앱().locator('#sfStat .sf-pt.me').first();
  if (!(await 앱().locator('#sfStat .sf-pt.me.pad, #sfStat .sf-pt.me.iso').count()))
    문제.push('04 — 내 위치가 구역 안으로 나오지 않음');
  표시('04판정', { 자리: await 자리(판정), 글: (await 판정.innerText().catch(() => '')).replace(/\s+/g, ' ') });
  await 잠깐(2600);

  /* ④ 01 주민 대피장소 찾기 — 04 의 사고지점·물질을 그대로 받아 엶 */
  await 누르기('#goMap', { 뒤: 200, 표: '01누름' });
  await 넘어감(/\/map\//);
  표시('01');
  await 잠깐(500);
  const 토스트 = (await 앱().locator('#mToast:not([hidden])').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (!/현장 안전거리 확인에서 정한 사고지점/.test(토스트)) 문제.push('01 — 넘겨받았다는 안내가 안 보임: ' + 토스트);
  if ((await 앱().locator('#mMat').inputValue().catch(() => '')) !== '암모니아') 문제.push('01 — 물질이 넘어오지 않음');
  const 찍01 = await 찍힌자리();
  if (!찍01 || 거리m(찍01, 사고) > 60) 문제.push('01 사고지점이 어긋남: ' + JSON.stringify(찍01));
  /* 넘겨받았다는 안내는 지도 칸 아래쪽에 떠서 390×800 화면에서는 밖에 있습니다. 사람이
     하듯 조금 내려 그 안내가 보이게 합니다 — 요청문이 꼭 보여 달라고 한 장면. 안내 글에
     「영향 참고 반경은 초기이격거리 300m」 까지 적혀 있어 물질·거리가 넘어온 것도 함께 읽힙니다. */
  const 내림 = await 앱().evaluate(() => {
    /* 화면 아래 가운데에는 「아래로 내려 목록 보기」 단추가 떠 있어 그 위로 올려야 읽힙니다 */
    const t = document.querySelector('#mToast').getBoundingClientRect();
    return Math.max(0, t.bottom - (innerHeight - 84));
  });
  if (내림 > 0) { await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), 내림); await 잠깐(650); }
  표시('01받음', { 자리: await 자리('#mToast'), 물질: await 자리('#mRad') });
  if (!(await 앱().evaluate(() => { const r = document.querySelector('#mToast').getBoundingClientRect(); return r.bottom <= innerHeight - 70 && r.top >= 56; })))
    문제.push('01 — 넘겨받았다는 안내가 화면 밖에 있음');
  await 타일기다리기(2500);
  await 잠깐(1200);
  if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 800 });
  else { await 보이게(찾기('#shList')); await 잠깐(400); }
  /* 화학사고 대피장소를 고릅니다 — 이재민 임시주거시설을 고르면 "실제 대피는 그쪽"처럼
     읽힐 수 있습니다(CLAUDE.md 7절). */
  await 누르기(앱().locator('#shList .ms-it', { hasText: '화학사고' }).first(), { 뒤: 900 });
  표시('01고름');
  await 누르기('#btnToSms', { 뒤: 200, 표: '02누름' });
  await 넘어감(/\/sms\//);

  /* ⑤ 02 주민대피 문자생성기 — 넘겨받은 칸은 그대로 두고 나머지만 채움 */
  표시('02');
  await 잠깐(700);
  표시('02받음', { 자리: await 자리('#seedBar') });
  await 잠깐(900);
  await 누르기('#stages button[data-s=evac]', { 뒤: 800 });
  const 다음 = () => 누르기('#stepNav .sn-next', { 앞: 220, 뒤: 650 });
  await 누르기('#types button[data-t="누출"]', { 뒤: 450 });
  await 다음();
  await 치기('#if_기관', '여수시', 100);
  await 누르기('#if_시각', { 뒤: 200 });
  await 찾기('#if_시각').fill('14:20');
  await 잠깐(350);
  await 다음();
  if (!(await 찾기('#if_시군').inputValue().catch(() => ''))) await 치기('#if_시군', '여수시', 100);
  if (!(await 찾기('#if_읍면동').inputValue().catch(() => ''))) await 치기('#if_읍면동', '주삼동', 100);
  await 치기('#if_사업장', '○○화학', 120);
  await 다음();
  await 치기('#if_대상지역', '주삼동 일원', 100);
  await 다음();
  await 치기('#if_물질', '암모니아', 120);
  await 잠깐(300);
  const 물질줄 = 앱().locator('.mpk-row', { hasText: '암모니아' }).first();
  await 누르기((await 물질줄.count()) ? 물질줄 : 앱().locator('.mpk-row').first(), { 뒤: 650 });
  await 다음();
  await 다음();                                                                 // 대피장소 — 넘겨받은 그대로
  await 맨위로(500);
  const 문안 = 앱().locator('#out .out:not(.bad) .msg').first();
  if (!(await 문안.count())) 문제.push('02 — 문안이 만들어지지 않음(빈칸이 남음)');
  표시('02문안', { 자리: await 자리(문안) });
  await 잠깐(1500);
  await 누르기('#out .out:not(.bad) footer button.p', { 뒤: 1100 });
  표시('끝');
  await 잠깐(600);

  await cdp.send('Page.stopScreencast');
  const 끝 = Date.now();
  await ctx.close();
  await browser.close();
  서버.close();

  if (시각들.length < 30) { console.error('⚠ 받은 장면이 너무 적습니다: ' + 시각들.length); process.exit(1); }
  /* 받은 장면을 받은 시각대로 이어 붙여 30장/초 영상으로 — 영상의 0초 = 첫 장면 */
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
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', 원본영상]);
  const 상대 = (t) => +(t - t0).toFixed(3);
  const 기록 = {
    설명: '휴대전화 화면 녹화본의 장면 시각(초 · 영상의 0초 기준). make_short_video_flow.mjs 가 씁니다.',
    녹화한날: new Date().toISOString(), 화면, 배경지도타일: 타일,
    사고, 내위치: { lat: 북동700.latitude, lon: 북동700.longitude },
    표: 표.map((m) => ({ ...m, t: 상대(m.t) })),
    누름: 누름.map((m) => ({ ...m, t: 상대(m.t) })),
    문제,
  };
  writeFileSync(원본표, JSON.stringify(기록, null, 1));
  console.log(`녹화 ${((끝 - 시작) / 1000).toFixed(1)}초 · 장면 ${시각들.length}장 · 배경지도 타일 ${타일}장`);
  for (const m of 기록.표) console.log(`  ${String(m.t.toFixed(2)).padStart(6)}  ${m.k}${m.글 ? ' — ' + m.글 : ''}`);
  if (문제.length) { console.error('⚠ 고칠 것\n  ' + 문제.join('\n  ')); process.exit(1); }
}

/* ══════════════════════════════════════════════════════════════
   엮기 — 녹화본을 30초대로 엮고 자막·타이머·누름 자국을 얹습니다.
   ══════════════════════════════════════════════════════════════ */
async function 엮기() {
  if (!existsSync(원본영상) || !existsSync(원본표)) throw new Error('녹화본이 없습니다 — 먼저 `녹화` 를 돌리세요');
  const 기록 = JSON.parse(readFileSync(원본표, 'utf8'));
  const 때 = (k) => {
    const m = 기록.표.find((x) => x.k === k);
    if (!m) throw new Error('녹화 기록에 없는 표시: ' + k);
    return m;
  };
  const r = (k, 더 = 0) => 때(k).t + 더;

  /* 영상의 차례 — 장면마다 **끝나는 시각만** 정합니다(4·14·22·26·32초 = 120 BPM 의 마디 첫 박 ·
     음악의 큰 북 자리). 장면 안의 조각은 [녹화 시작, 녹화 끝, 무게] — 그 장면의 길이를
     무게 × 녹화 길이에 비례해 나눕니다. 읽어야 하는 대목(협의업체 · 구역 판정 · 넘겨받음 · 문안)은
     무게를 높여 천천히, 치고 누르는 대목은 빠르게. **실제보다 느리게는 돌리지 않습니다**
     (슬로모션이면 타이머가 실제보다 늦게 가 보입니다) — 넘치는 몫은 다른 조각에 돌립니다. */
  const 첫화면 = 1.2;                         // 앞 1.2초는 QR 만(휴대전화가 아직 안 열림)
  const 장면들 = [
    { 끝: 4, 조각: [[r('접속'), r('03누름', 0.1), 1]] },
    { 끝: 14, 조각: [[r('03누름', 0.1), r('03목록'), 1], [r('03목록'), r('03담음', 0.7), 3]] },
    { 끝: 22, 조각: [[r('03담음', 0.7), r('04누름', 0.1), 1], [r('04누름', 0.1), r('04판정', -0.3), 1],
                     [r('04판정', -0.3), r('01누름', 0.1), 3]] },
    { 끝: 26, 조각: [[r('01누름', 0.1), r('01고름'), 2], [r('01고름'), r('02누름', 0.1), 1]] },
    { 끝: 32, 조각: [[r('02누름', 0.1), r('02문안', -0.2), 1], [r('02문안', -0.2), r('끝', 0.3), 3]] },
  ];
  const 나누기 = (조각, D) => {
    const 몫 = 조각.map(() => null);
    for (;;) {
      const 남은 = 조각.map((g, i) => i).filter((i) => 몫[i] == null);
      if (!남은.length) break;
      const 쓸 = D - 몫.reduce((a, x) => a + (x || 0), 0);
      const 합 = 남은.reduce((a, i) => a + 조각[i][2] * (조각[i][1] - 조각[i][0]), 0);
      const 넘침 = 남은.filter((i) => 쓸 * 조각[i][2] * (조각[i][1] - 조각[i][0]) / 합 > 조각[i][1] - 조각[i][0]);
      if (!넘침.length || 넘침.length === 남은.length) {
        남은.forEach((i) => { 몫[i] = 쓸 * 조각[i][2] * (조각[i][1] - 조각[i][0]) / 합; });
        break;
      }
      넘침.forEach((i) => { 몫[i] = 조각[i][1] - 조각[i][0]; });   // 실제 길이 그대로(1배)
    }
    return 몫;
  };
  let 누적 = 첫화면;
  const 구간 = [];
  const 조각시작 = [];
  for (const 장 of 장면들) {
    const 몫 = 나누기(장.조각, 장.끝 - 누적);
    장.조각.forEach(([a, b], i) => {
      if (b <= a) throw new Error(`구간 순서가 이상합니다: ${a} → ${b}`);
      조각시작.push(누적);
      구간.push({ a, b, d: 몫[i], s: 누적, 배: (b - a) / 몫[i] });
      누적 += 몫[i];
    });
  }
  /* 장면이 바뀌는 자리 — 자막과 음악이 이 시각을 함께 씁니다 */
  const 장면 = { 방제: 조각시작[1], 협의: 조각시작[2], 안전: 조각시작[3], 대피: 조각시작[6],
                문자: 조각시작[8], 문안: 조각시작[9], 끝: 누적 };
  for (const g of 구간) if (g.배 < 0.98) console.warn(`⚠ 녹화가 짧아 실제보다 느리게 돕니다(×${g.배.toFixed(2)}) — 녹화의 기다림을 늘리세요`);
  const 내용끝 = 누적;                        // 32초
  const 길이 = Math.round((내용끝 + 4.0) * 2) / 2;
  const 원점 = r('접속');
  const 원시각 = (t) => {                      // 영상 시각 → 녹화 시각
    if (t < 첫화면) return null;
    for (const g of 구간) if (t < g.s + g.d) return g.a + (t - g.s) * g.배;
    const g = 구간[구간.length - 1];
    return g.b;
  };
  const 영상시각 = (rt) => {                   // 녹화 시각 → 영상 시각(누름 자국 자리)
    for (const g of 구간) if (rt >= g.a && rt < g.b) return g.s + (rt - g.a) / g.배;
    return null;
  };
  const 배속 = (t) => { for (const g of 구간) if (t >= g.s && t < g.s + g.d) return g.배; return 1; };
  console.log('구간', 구간.map((g) => `${g.s.toFixed(1)}~${(g.s + g.d).toFixed(1)}초 ×${g.배.toFixed(2)}`).join(' · '));

  const 작업 = path.join(RPATH, '.narr/흐름엮기');
  rmSync(작업, { recursive: true, force: true });
  mkdirSync(path.join(작업, '폰'), { recursive: true });
  mkdirSync(path.join(작업, '장면'), { recursive: true });

  /* 1) 휴대전화 화면을 구간마다 잘라 빠르기를 바꾸고 이어 붙임 — 영상 시각 그대로의 사진들 */
  const 거르개 = 구간.map((g, i) =>
    `[0:v]trim=start=${g.a.toFixed(3)}:end=${g.b.toFixed(3)},setpts=(PTS-STARTPTS)/${g.배.toFixed(5)},fps=${FPS}[v${i}]`).join(';')
    + ';' + 구간.map((g, i) => `[v${i}]`).join('') + `concat=n=${구간.length}:v=1:a=0[out]`;
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', 원본영상, '-filter_complex', 거르개,
    '-map', '[out]', '-q:v', '2', path.join(작업, '폰', '%05d.jpg')]);
  const 폰장수 = readdirSync(path.join(작업, '폰')).length;

  /* 2) 음악 — 장면 경계에 큰 북 */
  const 음악 = path.join(작업, '음악.wav');
  execFileSync(process.env.PYTHON || 'python3', [path.join(RPATH, 'build/make_short_music_flow.py'), 음악,
    JSON.stringify({ 길이, 큰북: [장면.방제, 장면.안전, 장면.대피, 장면.문자], 작은북: [장면.협의, 장면.문안], 끝북: 장면.끝 })],
    { stdio: 'inherit' });

  /* 3) 자막 · 이름표 차례 (영상 시각) */
  const 자막 = [
    [0, 장면.방제, '설치·회원가입 없이\nQR 하나로', ''],
    [장면.방제, 장면.협의, '무엇으로 막을까?', '03 방제 물품·장비 찾기'],
    [장면.협의, 장면.안전, '미리 협의된 업체가\n맨 위에', '03 방제 물품·장비 찾기'],
    [장면.안전, 장면.대피, '내 자리는 안전한가?', '04 현장 안전거리 확인'],
    [장면.대피, 장면.문자, '어디로 대피시킬까?', '01 주민 대피장소 찾기'],
    [장면.문자, 장면.문안, '무엇을 알릴까?', '02 주민대피 문자생성기'],
    [장면.문안, 내용끝, '승인받은 표준문안\n자동 생성', '02 주민대피 문자생성기'],
    [내용끝, 길이, '방제부터 대피 문자까지,\n휴대전화 하나로', ''],
  ];
  /* 덧글 — 앞 도구에서 정한 것이 그대로 넘어왔다는 것(요청문 — "꼭 보여 줄 것").
     넘어온 것만 적습니다: 04 → 01 은 사고지점·물질, 01 → 02 는 지역·대피장소. */
  const 덧글 = [
    [장면.대피, 장면.대피 + 3.2, '04에서 정한 사고지점·물질 그대로'],
    [장면.문자, 장면.문자 + 2.4, '01에서 고른 대피장소·지역 그대로'],
  ];
  /* 돋보기 — 휴대전화 화면의 작은 글씨를 자막 아래에 크게 떼어 보임(발표장 큰 화면에서도
     읽히게). 휴대전화 안 그 자리에는 주황 테두리를 둘러 어디를 키웠는지 잇습니다.
     휴대전화 자체를 키우면 화면 폭을 다 쓰는 상자는 가장자리가 잘렸습니다. */
  /* [표시, 녹화에서 몇 초 뒤부터, 영상에서 길게는 몇 초, 다음 누름 전에 끝낼까]
     — 누르면 그 자리가 바뀌거나 굴러가 카드에 엉뚱한 것이 비칩니다(03 · 04 · 01). 02 의 복사
     단추는 문안을 움직이지 않아 끝까지 둡니다. */
  const 다음누름 = (rt) => { const m = 기록.누름.find((x) => x.t > rt + 0.02); return m ? m.t : Infinity; };
  const 돋보기 = [['03목록', 0.1, 2.2, true], ['04판정', -0.25, 2.6, true], ['01받음', 0.05, 2.4, true],
    ['02문안', -0.15, 2.0, false]].map(([k, 덧, 길게, 끊기]) => {
    const 시작 = 영상시각(r(k, 덧));
    if (시작 == null || !때(k).자리) return null;
    const 끝누름 = 끊기 ? 영상시각(다음누름(r(k, 덧))) : null;
    return [시작, Math.max(0.6, Math.min(길게, 끝누름 != null ? 끝누름 - 0.05 - 시작 : 길게)), 때(k).자리];
  }).filter(Boolean);
  console.log('돋보기', 돋보기.map((z) => `${z[0].toFixed(1)}초부터 ${z[1].toFixed(1)}초`).join(' · '));
  const 뒤로때 = 영상시각(r('뒤로'));
  const 누름자국 = 기록.누름.map((m) => ({ t: 영상시각(m.t), x: m.x, y: m.y })).filter((m) => m.t != null);

  const 쉬움 = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const 상태 = (t) => {
    const 자 = 자막.find((s) => t >= s[0] && t < s[1]) || 자막[자막.length - 1];
    const 바뀐뒤 = t - 자[0];
    const rt = 원시각(t);
    const 끝남 = t >= 내용끝;
    const 경과 = 끝남 ? r('끝', 0.3) - 원점 : rt == null ? 0 : Math.max(0, rt - 원점);
    let 돋 = null;
    for (const [s, d, z] of 돋보기) {
      if (t >= s && t < s + d)돋 = { ...z, a: Math.min(쉬움((t - s) / 0.3), 쉬움((s + d - t) / 0.3)) };
    }
    const 폰i = Math.min(폰장수, Math.max(1, Math.floor((Math.min(t, 내용끝 - 0.001) - 첫화면) * FPS) + 1));
    const 덧 = 덧글.find((d) => t >= d[0] && t < d[1]);
    return {
      t, 자막: 자[2], 이름표: 자[3], 자막보임: 쉬움(바뀐뒤 / 0.3), 자막끝: 끝남,
      덧글: 덧 ? 덧[2] : '', 덧글보임: 덧 ? Math.min(쉬움((t - 덧[0] - 0.25) / 0.3), 쉬움((덧[1] - t) / 0.3)) : 0,
      폰: t >= 첫화면 ? 'file://' + path.join(작업, '폰', String(폰i).padStart(5, '0') + '.jpg') : null,
      폰보임: 쉬움((t - 첫화면 + 0.15) / 0.45),
      경과, 배: 끝남 || rt == null ? 1 : 배속(t), 돋,
      누름: 누름자국.filter((m) => t >= m.t && t < m.t + 0.45).map((m) => ({ x: m.x, y: m.y, a: (t - m.t) / 0.45 })),
      뒤로: 뒤로때 != null && t >= 뒤로때 - 0.1 && t < 뒤로때 + 0.9,
      스캔: t < 첫화면 + 0.3 ? t / 첫화면 : 1,
      끝: 쉬움((t - 내용끝) / 0.6), 어둡게: Math.max(0, (t - (길이 - 0.45)) / 0.45),
    };
  };

  /* 4) 무대를 한 장씩 찍음 */
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(RPATH, 'build/영상30_흐름무대.html'));
  await page.evaluate((o) => window.준비(o), {
    qr: 'file://' + path.join(RPATH, 'docs/QR/QR_접속.svg'), 폭: 기록.화면.width, 높이: 기록.화면.height,
  });
  const 장수 = Math.round(길이 * FPS);
  for (let k = 0; k < 장수; k++) {
    await page.evaluate((s) => window.장면(s), 상태(k / FPS));
    await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    if (k % 150 === 0) console.log(`찍는 중 ${k}/${장수}`);
  }
  await browser.close();

  /* 5) 사진 + 음악 → mp4 (첫 판과 같은 소리 손질 · -14 LUFS) */
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS),
    '-i', path.join(작업, '장면', 'f%05d.jpg'), '-i', 음악,
    '-filter_complex', '[1:a]aecho=0.8:0.55:45|95:0.16|0.09,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', process.env.FFPRESET || 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 낼]);
  console.log(`만듦 ${낼} — ${길이}초 · 자동 시연 경과 ${(r('끝', 0.3) - 원점).toFixed(1)}초`);
}
