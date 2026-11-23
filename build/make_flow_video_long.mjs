/* 결선 발표용 「사고 흐름 판」(3분 20초 안팎) — 녹화 · 조립
   ───────────────────────────────────────────────────────────────
       node build/make_flow_video_long.mjs 녹화 --상황실 .narr/상황실판   # 휴대전화 화면 녹화 → source/녹화/사고흐름_원본.*
       node build/make_flow_video_long.mjs 엮기                         # 자막·사고 카드·타이머·음악 → docs/공모전_결선_사고흐름.mp4
       node build/make_flow_video_long.mjs 둘다 --상황실 .narr/상황실판
       node build/make_flow_video_long.mjs 엮기 --미리 3,9,40            # 그 순간만 사진으로(무대를 고칠 때)

   ── 왜 만드나 (2026-11-23 사용자) ─────────────────────────────────
   "흐름으로 만든 영상 … 사고의 실제 흐름을 보여주는 영상이니까, 사고가 발생했다 라는 걸 시작으로
   이 사고를 대처하기 위해 우리의 서비스가 어떻게 진행이 되는지를 보여주는 과정 … 사고 사업장이나
   이런걸 좀 글씨가 잘 보이게 … 방제자원을 찾고 상황실로 전화연결이 가능하다는 것을 보이고, 내 현재
   위치가 사고로부터 안전한지를 확인하는 장면, 인근 주민대피장소를 찾는 장면, 주민대피 문자를 보내는
   장면 … 사고를 가정한 것이라는 것이 좀 눈에 보여야 하고, 시간초도 대략적으로 3분20초 대로 … 강조음인
   북소리는 마찬가지로 수정".
   36초 흐름 판(make_short_video_flow.mjs → docs/공모전_결선_30초_흐름.mp4)은 **그대로 둡니다** —
   이 판은 파일을 따로 씁니다.

   ── 흐름 판과 다른 것 ─────────────────────────────────────────
   · **가상 사고가 먼저 뜹니다** — 「가상 상황 · 실제 사고가 아닙니다」 딱지와 함께 화면 가운데에
     크게(사고 시각 · 여수시 주삼동 · ○○화학 사업장 · 암모니아 누출) → 왼쪽 위로 줄어들어 **끝까지 그 자리에**
     있습니다. 흐름 판은 왼쪽 아래 작은 글씨 한 줄이었습니다(사용자 — "눈에 띄게").
     · 사업장 이름은 **○○화학**입니다 — 실제 회사 이름을 사고 예시에 넣지 않습니다(02 문자 장면에
       치는 이름과 같음). 사고 시각 14:20 도 02 에서 치는 값과 같습니다.
   · **실제 빠르기 그대로** 돌립니다 — 흐름 판은 73초 녹화를 32초로 몰아 「○배 빠르게」였습니다.
     이 판은 녹화에서 사람이 읽을 틈을 실제로 기다리고(아래 `머묾`), 영상은 1배(장면 경계를 박자에
     맞추느라 아주 조금 빠를 수 있음)로 엮습니다. 타이머는 여전히 **녹화된 그 장면의 실제 시각**입니다.
   · 03 은 **업체 섭외 → 미리 협의된 업체 → 「안전원 상황실」 바로 전화 → 세부 창 → 동원 목록**,
     이어서 **방제물품(흡착포)** 까지. 상황실 전화 기능은 다른 작업 가지의 커밋 a869d46 에만 있어
     **03 화면만 그 코드로** 엽니다(`--상황실` 폴더 · 아래 서버). 나머지 화면은 이 가지 그대로입니다.
   · 강조음은 줌인 판과 같은 **부드러운 북**(build/make_flow_music_long.py).

   ── 지키는 것 ─────────────────────────────────────────────────
   · 휴대전화 안은 **실제 서비스**입니다. 무대는 테두리 · 사고 카드 · 자막 · 타이머 · 확대만 맡습니다.
   · 업체명·전화번호는 흐립니다. **안전원 상황실 번호만은 흐리지 않습니다**(이 장면이 보여 주는 것이고
     업체·담당자 번호가 아님). 누른 상황실 링크가 정말 tel:0438304120 인지 녹화가 확인합니다 —
     누른 뒤 휴대전화에 뜨는 전화 화면은 기기마다 달라 그리지 않습니다.
   · 02 는 문안을 **만들고 복사**합니다 — 이 서비스가 문자를 직접 보내지는 않으므로 자막도
     「복사해 그대로 발송 시스템으로」 라고만 씁니다.
   · 사고지점은 03·04 에서 같은 좌표(`사고`), 내 위치는 북동쪽 700m · 남서풍 → 「방호활동 구역 안」.
     어긋나면 녹화가 멈춥니다(흐름 판과 같음).

   ── 배경지도 ───────────────────────────────────────────────────
   개발 자리는 타일 서버로 못 나가 지도에 경계선만 나옵니다(CLAUDE.md 6절). 내는 판은 액션
   러너에서 녹화합니다 — .github/workflows/결선영상_사고흐름_굽기.yml(push 로 저절로).
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
const 인자값 = (이름) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : null; };
const 상황실폴더 = 인자값('--상황실') ? path.resolve(인자값('--상황실')) : null;
const 미리 = 인자값('--미리') ? 인자값('--미리').split(',').map(Number) : null;
const 원본방 = path.join(RPATH, 'source/녹화');
const 원본영상 = path.join(원본방, '사고흐름_원본.mp4');
const 원본표 = path.join(원본방, '사고흐름_원본.json');
const 낼 = path.join(RPATH, 'docs/공모전_결선_사고흐름.mp4');
const ff = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const 화면 = { width: 390, height: 800 };   // 휴대전화 화면(css px) — 무대의 휴대전화 틀과 같은 비율
const 상황실번호 = 'tel:0438304120';

/* 가상 사고 — 무대의 사고 카드와 02 문자 장면에 같은 값을 씁니다 */
const 가상사고 = { 시각: '14:20', 곳: '전라남도 여수시 주삼동', 사업장: '○○화학', 물질: '암모니아' };
/* 가상 사고지점과 근무자 자리 — 흐름 판과 같은 자리 */
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

if (!['녹화', '엮기', '둘다'].includes(모드)) { console.error('쓰는 법: 녹화 | 엮기 | 둘다 [--상황실 폴더]'); process.exit(2); }
if (모드 === '녹화' || 모드 === '둘다') await 녹화();
if (모드 === '엮기' || 모드 === '둘다') await 엮기();

/* ══════════════════════════════════════════════════════════════
   녹화 — 휴대전화 화면만 받습니다. 장면마다 받은 시각을 적어 두어 타이머가 실제 시각을 띄웁니다.
   ══════════════════════════════════════════════════════════════ */
async function 녹화() {
  if (!상황실폴더 || !existsSync(path.join(상황실폴더, 'res/app.js')))
    throw new Error('--상황실 폴더가 필요합니다 — git worktree add --detach .narr/상황실판 a869d46');
  if (!/rk-emg-tel/.test(readFileSync(path.join(상황실폴더, 'res/app.js'), 'utf8')))
    throw new Error('--상황실 폴더의 03 에 「안전원 상황실」 전화 링크가 없습니다(커밋 a869d46 을 꺼내세요)');
  const 작업방 = path.join(RPATH, '.narr/사고흐름녹화');
  rmSync(작업방, { recursive: true, force: true });
  mkdirSync(작업방, { recursive: true });
  mkdirSync(원본방, { recursive: true });

  const 종류 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  /* 틀 — 휴대전화 화면(390×800)을 2배로 키워 받습니다(흐름 판과 같은 까닭 · 화면 중계는
     화소 배율을 무시함). html·body 를 키운 크기로 잡아야 아래 절반을 누를 수 있습니다. */
  const 틀HTML = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:780px;height:1600px;'
    + 'overflow:hidden;background:#fff}iframe{border:0;width:390px;height:800px;transform:scale(2);'
    + 'transform-origin:0 0;display:block}</style><iframe name="app" src="/index.html"></iframe>';
  /* 03 화면만 상황실 기능이 있는 코드에서 — 03 문서와, 03 문서가 부르는 것(스타일·자료·스크립트)을
     그 폴더에서 냅니다. 누가 불렀는지는 Referer 로 압니다(같은 출처라 전체 주소가 옵니다).
     나머지(첫 화면 · 04 · 01 · 02)는 이 가지 그대로입니다. */
  const 뿌리 = (q, u) => {
    let 부른 = '';
    try { 부른 = new URL(q.headers.referer || '').pathname; } catch (e) { /* 없음 */ }
    return u.startsWith('/res/') || 부른.startsWith('/res/') ? 상황실폴더 : RPATH;
  };
  const 서버 = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__틀.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(틀HTML); }
    if (u.endsWith('/')) u += 'index.html';
    const 밑 = 뿌리(q, u);
    const f = path.join(밑, path.normalize(u));
    if (!f.startsWith(밑) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': 종류[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
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
  /* 가리기 — 흐름 판과 같은 규칙에 **안전원 상황실 번호만 예외**. 누른 tel: 링크는 녹화 브라우저에
     전화가 없어 어디로도 안 가게만 막고(화면은 그대로), 무엇을 눌렀는지 적어 둡니다. */
  await ctx.addInitScript(() => {
    if (window.top === window) return;
    const 방제 = /\/res\//.test(location.pathname);
    const 붙이기 = () => {
      if (!document.head) return setTimeout(붙이기, 20);
      const s = document.createElement('style');
      s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
        + 'a[href^="tel:"],.rs-num,.rkd-tel,.rkd-tel2{filter:blur(7px)!important}'
        + '.rk-emg a.rk-emg-tel{filter:none!important}'
        + '.__가림{filter:blur(6px)!important;font-style:normal}'
        + (방제 ? '.ms-it .l1 b,.rkd header b,.mnear-it b,#mAddr b,.mob-it{filter:blur(6px)!important}'
                + 'svg text.mkl{display:none!important}' : '');
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
        if (위.closest('.rk-emg-tel')) continue;                    // 안전원 상황실 번호는 그대로
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
  const 틀 = 2;
  const 앱 = () => p.frame({ name: 'app' });
  const 자리 = async (sel, 최대높이) => {
    const l = typeof sel === 'string' ? 앱().locator(sel).first() : sel;
    const b = await l.boundingBox().catch(() => null);
    if (!b) return null;
    const z = { x: b.x / 틀, y: b.y / 틀, w: b.width / 틀, h: b.height / 틀 };
    if (최대높이) z.h = Math.min(z.h, 최대높이);
    // 화면 밖으로 나간 부분은 자름 — 돋보기에 빈 곳이 비치지 않게
    if (z.y < 0) { z.h += z.y; z.y = 0; }
    z.h = Math.min(z.h, 화면.height - z.y);
    return z.h > 8 ? z : null;
  };
  /* 돋보기 자리를 **줄 경계에서** 자름 — 위에서부터 고른 조각들의 아래 끝까지(글줄 가운데서 잘리지 않게) */
  const 줄까지 = async (loc, 조각) => {
    const z = await 자리(loc);
    if (!z) return null;
    const 끝 = await loc.evaluate((el, 조각) => {
      let b = 0;
      el.querySelectorAll(조각).forEach((c) => { b = Math.max(b, c.getBoundingClientRect().bottom); });
      return b;
    }, 조각).catch(() => 0);
    if (끝 > 0) z.h = Math.max(20, Math.min(z.h, 끝 - z.y + 1));
    return z;
  };
  const 넘어감 = async (꼴) => {
    await 앱().waitForURL(꼴, { timeout: 20000 });
    await 앱().waitForLoadState('load');
  };
  /* 머묾 — 사람이 화면을 읽는 틈. 누르기 전 틈(0.65초)·글자 치는 속도와 함께 **사람이 실제로 하는
     빠르기**에 맞춥니다 — 그래서 오른쪽 위 시계가 3분 20초 안팎까지 흐릅니다(2026-11-23 사용자 — "시계가
     3분20초로 뜨는 것은 좋아. 하지만 영상은 30~40초"). 영상은 그 녹화를 빠르게 돌리고 「○배 빠르게」를 띄웁니다. */
  const 잠깐 = (ms) => p.waitForTimeout(ms);
  const 머묾 = (ms) => 잠깐(Math.round(ms * 1.12));
  const 찾기 = (대상) => (typeof 대상 === 'string' ? 앱().locator(대상).first() : 대상);
  const 보이게 = async (loc) => {
    const 안 = await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 60 && r.bottom <= innerHeight - 60;
    }).catch(() => true);
    if (!안) {
      await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await 잠깐(700);
    }
  };
  const 톡 = async (x, y, { 앞 = 650, 뒤 = 850, 표: 이름 } = {}) => {
    await 잠깐(앞);
    if (이름) 표시(이름);
    누름.push({ t: Date.now() / 1000, x, y });
    await p.touchscreen.tap(x * 틀, y * 틀);
    await 잠깐(뒤);
  };
  const 누르기 = async (대상, { 앞 = 650, 뒤 = 850, 표: 이름 } = {}) => {
    const loc = 찾기(대상);
    try { await loc.waitFor({ state: 'visible', timeout: 9000 }); }
    catch (e) { 문제.push('못 찾음: ' + 대상); return false; }
    await 보이게(loc);
    const b = await loc.boundingBox();
    if (!b) { 문제.push('자리 없음: ' + 대상); return false; }
    await 톡((b.x + b.width / 2) / 틀, (b.y + b.height / 2) / 틀, { 앞, 뒤, 표: 이름 });
    return true;
  };
  const 치기 = async (칸, 값, 속도 = 240) => {
    if (!(await 누르기(칸, { 뒤: 300 }))) return false;
    await 찾기(칸).pressSequentially(값, { delay: 속도 });
    await 잠깐(600);
    return true;
  };
  const 굴리기 = async (dy, ms = 900) => {
    await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), dy);
    await 잠깐(ms);
  };
  const 맨위로 = async (ms = 700) => {
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
    await 잠깐(타일 > 0 ? 700 : 150);
  };
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
    await 잠깐(800);
    const g = await 앱().evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      const bar = document.querySelector('#scaleBar').getBoundingClientRect().width;
      const m = /([\d.]+)\s*(k?m)/.exec(document.querySelector('#scaleTxt').textContent || '');
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, mpp: m && bar ? (+m[1] * (m[2] === 'km' ? 1000 : 1)) / bar : null };
    }, 지도);
    if (!g.mpp) { 문제.push('축척을 못 읽음: ' + 지도); return; }
    const dx = (사고.lon - C.lon) * 111320 * Math.cos(C.lat * Math.PI / 180) / g.mpp;
    const dy = -(사고.lat - C.lat) * 110574 / g.mpp;
    await 톡(g.cx + dx, g.cy + dy, { 앞: 600, 뒤: 1100 });
  };
  const 찍힌자리 = async () => {
    const v = await 앱().evaluate(() => [document.querySelector('#acLat'), document.querySelector('#acLon')]
      .map((e) => (e ? parseFloat(e.value) : NaN)));
    return isFinite(v[0]) && isFinite(v[1]) ? { lat: v[0], lon: v[1] } : null;
  };
  /* 03 — 사고지점을 '주삼동' 으로 찾아 같은 자리를 찍고 목록으로 내려감 */
  const 방제사고지점 = async (이름) => {
    await 치기('#startQ', '주삼동');
    await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 1000 });
    await 타일기다리기();
    await 사고찍기('.mmap', await 동가운데('방제'));
    표시(이름);
    const 찍 = await 찍힌자리();
    if (!찍 || 거리m(찍, 사고) > 60) 문제.push(이름 + ' — 사고지점이 어긋남: ' + JSON.stringify(찍));
    await 타일기다리기(2500);
  };
  const 목록으로 = async (이름) => {
    if (await 앱().locator('.list-hint.on').count()) await 누르기('.list-hint.on', { 뒤: 1100, 표: 이름 });
    else { 표시(이름); await 보이게(찾기('#shList')); await 잠깐(500); }
  };

  /* ── 녹화 시작 ── */
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 화면.width * 틀, maxHeight: 화면.height * 틀 });
  const 시작 = Date.now();

  /* ① 접속 — 첫 화면 */
  await p.goto(`${BASE}/__틀.html`, { waitUntil: 'load' });
  await 앱().evaluate(() => document.fonts.ready);
  표시('접속');
  await 머묾(4200);

  /* ② 03 방제 물품·장비 찾기 — 업체 섭외 */
  await 누르기('li.pn a[href*="res/"]', { 뒤: 200, 표: '03누름' });
  await 넘어감(/\/res\//);
  표시('03');
  await 머묾(1600);
  await 누르기('.rz-br >> nth=0', { 뒤: 1500 });                                  // 업체 섭외
  await 누르기(앱().locator('.rz-need', { hasText: '수집·운반' }).first(), { 뒤: 1200 });
  await 누르기('#rzNext', { 뒤: 1100 });
  await 방제사고지점('03찍음');
  await 머묾(2600);                                                             // 지도 위 업체들
  await 목록으로('03목록으로');
  await 머묾(800);
  const 협의줄 = 앱().locator('#shList .ms-it').filter({ has: 앱().locator('.tag.first') }).first();
  const 첫줄 = 앱().locator('#shList .ms-it').first();
  if (!(await 협의줄.count())) 문제.push('03 — 미리 협의된 업체가 목록에 없음');
  else if (!(await 첫줄.locator('.tag.first').count())) 문제.push('03 — 미리 협의된 업체가 맨 위가 아님');
  표시('03목록', { 자리: await 줄까지(첫줄, '.l0, .l1'), 머리: await 자리(첫줄.locator('.l0').first()) });
  await 머묾(3000);
  /* 상황실 바로 전화 — 맨 위 협의업체 줄의 「비상연락망(휴대전화) ▶ 안전원 상황실 …」 */
  const 전화 = 첫줄.locator('.rk-emg a.rk-emg-tel').first();
  if (!(await 전화.count())) 문제.push('03 — 맨 위 줄에 「안전원 상황실」 전화 링크가 없음');
  표시('03전화줄', { 자리: await 자리(첫줄.locator('.rk-emg').first()), 글: (await 첫줄.locator('.rk-emg').innerText().catch(() => '')).replace(/\s+/g, ' ') });
  await 머묾(1200);
  await 누르기(전화, { 앞: 200, 뒤: 400, 표: '03전화' });
  const 눌린 = await 앱().evaluate(() => window.__누른전화 || '');
  if (눌린 !== 상황실번호) 문제.push(`03 — 누른 링크가 상황실 번호가 아님: "${눌린}"`);
  if (await 앱().locator('#shList .ms-it.on').count()) 문제.push('03 — 상황실 링크를 눌렀는데 줄 고르기가 함께 일어남');
  await 머묾(3600);
  /* 다른 업체들도 훑어봄 — 천천히 내렸다가 올림 */
  await 굴리기(420, 2600);
  await 굴리기(-420, 1500);
  await 누르기(첫줄.locator('.l2').first(), { 뒤: 1300 });                       // 줄을 누르면 세부 창
  표시('03세부', { 자리: await 자리('#rkDet .rkd', 260) || await 자리('#rkDet', 260) });
  await 머묾(4000);
  await 누르기(앱().locator('#rkDet button', { hasText: '동원 목록에 담기' }).first(), { 뒤: 900 });
  if (!(await 앱().locator('#rMob:not([hidden]) .mob-n').count())) 문제.push('03 — 동원 목록에 담기지 않음');
  표시('03담음', { 자리: await 자리('#rMob') });
  await 머묾(2800);

  /* 03 방제물품 — 갈래를 바꾸려면 방제 화면을 처음부터(결과의 '조건 바꾸기'는 같은 갈래 안의 거르개).
     새로고침이라 휴대전화의 '뒤로' 한 번이면 첫 화면으로 돌아갑니다. */
  표시('03물품');
  await 앱().evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* 없음 */ } location.reload(); });
  await 앱().waitForLoadState('load');
  await 머묾(1500);
  await 누르기('.rz-br >> nth=1', { 뒤: 1500 });                                  // 방제물품 찾기
  await 누르기(앱().locator('.rz-item', { hasText: '흡착포' }).first(), { 뒤: 1200 });
  await 누르기('#rzNext', { 뒤: 1100 });
  /* 물품 갈래의 찾기 목록에는 '주삼동' 이 없습니다(그 동에 물품을 가진 곳이 없어 색인에 안 들어감 ·
     공모전 시연영상도 그래서 「내 위치」 로 열었음). 내 위치(사고지점에서 북동 700m)로 지도를 연 뒤,
     조금 확대해 「사고지점 찍기」 로 **같은 사고지점**을 다시 찍습니다 — 지도 가운데가 내 위치라
     축척 막대로 셀 수 있습니다. */
  await 누르기('#startMe', { 뒤: 1800 });
  for (let i = 0; i < 5; i++) await 누르기('#zIn', { 앞: 200, 뒤: 380 });
  await 누르기('#btnAcc', { 뒤: 700 });
  await 사고찍기('.mmap', { lat: 북동700.latitude, lon: 북동700.longitude });
  표시('03물품찍음');
  const 찍물 = await 찍힌자리();
  if (!찍물 || 거리m(찍물, 사고) > 60) 문제.push('03물품 — 사고지점이 어긋남: ' + JSON.stringify(찍물));
  await 타일기다리기(2500);
  await 머묾(1800);
  await 목록으로('03물품목록으로');
  await 머묾(700);
  표시('03물품목록', { 자리: await 줄까지(앱().locator('#shList .ms-it').first(), '.l1, .l6, .l2, .l7') });
  await 머묾(3000);
  await 누르기(앱().locator('#shList .ms-it').first().locator('.l2').first(), { 뒤: 1300 });
  표시('03물품세부', { 자리: await 줄까지(앱().locator('#rkDet .rkd-items').first(), 'li:nth-child(-n+3)') || await 자리('#rkDet .rkd', 220) });
  await 머묾(4000);
  await 누르기('#rkDet .rkd-close', { 뒤: 700 });

  /* ③ 04 현장 안전거리 확인 — 첫 화면으로 돌아가(휴대전화의 '뒤로') 04 카드를 누름 */
  표시('뒤로');
  await 앱().evaluate(() => history.back());
  await 넘어감(/\/index\.html$/);
  await 머묾(1300);
  await 누르기('li.pn a[href*="safe/"]', { 뒤: 200, 표: '04누름' });
  await 넘어감(/\/safe\//);
  표시('04');
  await 머묾(1600);
  await 치기('#sfMat', '암모니아', 250);
  await 누르기(앱().locator('.mpk:not(#addrPop) .mpk-row', { hasText: '암모니아' }).first(), { 뒤: 1000 });
  await 치기('#sfAddr', '주삼동');
  await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 1000 });
  await 타일기다리기();
  await 사고찍기('#map', await 동가운데('대피장소'));
  표시('04찍음');
  await 머묾(1600);
  await 맨위로();
  await 누르기('#segSize button[data-v="l"]', { 뒤: 1200 });                    // 대규모
  await 누르기('#windBtn', { 뒤: 1300 });
  await 누르기('#windPop .wr-b[data-deg="225"]', { 뒤: 1100 });                  // 남서풍
  표시('04구역');
  await 보이게(찾기('#map'));
  await 머묾(3000);                                                             // 구역이 그려진 지도
  await 맨위로();
  await 누르기('#btnWatch', { 뒤: 1600 });
  const 판정 = 앱().locator('#sfStat .sf-pt.me').first();
  if (!(await 앱().locator('#sfStat .sf-pt.me.pad, #sfStat .sf-pt.me.iso').count()))
    문제.push('04 — 내 위치가 구역 안으로 나오지 않음');
  표시('04판정', { 자리: await 자리(판정), 글: (await 판정.innerText().catch(() => '')).replace(/\s+/g, ' ') });
  await 머묾(4200);
  /* 거리 표 — 물질정보의 ERG 거리 그대로 */
  const 표자리 = 앱().locator('#sfMore .sf-tbl').first();
  if (await 표자리.count()) {
    await 표자리.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await 잠깐(800);
    표시('04표', { 자리: await 자리(표자리, 200) });
    await 머묾(3400);
  } else 문제.push('04 — 거리 표가 없음');

  /* ④ 01 주민 대피장소 찾기 — 04 의 사고지점·물질을 그대로 받아 엶 */
  await 누르기('#goMap', { 뒤: 200, 표: '01누름' });
  await 넘어감(/\/map\//);
  표시('01');
  await 머묾(700);
  const 토스트 = (await 앱().locator('#mToast:not([hidden])').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (!/현장 안전거리 확인에서 정한 사고지점/.test(토스트)) 문제.push('01 — 넘겨받았다는 안내가 안 보임: ' + 토스트);
  if ((await 앱().locator('#mMat').inputValue().catch(() => '')) !== '암모니아') 문제.push('01 — 물질이 넘어오지 않음');
  const 찍01 = await 찍힌자리();
  if (!찍01 || 거리m(찍01, 사고) > 60) 문제.push('01 사고지점이 어긋남: ' + JSON.stringify(찍01));
  /* 넘겨받았다는 안내는 지도 칸 아래쪽에 떠 「목록 보기」 단추 위로 오게 조금 내립니다(흐름 판과 같음) */
  const 내림 = await 앱().evaluate(() => {
    const t = document.querySelector('#mToast').getBoundingClientRect();
    return Math.max(0, t.bottom - (innerHeight - 84));
  });
  if (내림 > 0) { await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), 내림); await 잠깐(700); }
  표시('01받음', { 자리: await 자리('#mToast') });
  await 타일기다리기(2500);
  await 머묾(3400);
  await 목록으로('01목록으로');
  await 머묾(1800);
  /* 화학사고 대피장소를 고릅니다 — 이재민 임시주거시설을 고르면 "실제 대피는 그쪽"처럼 읽힐 수
     있습니다(CLAUDE.md 7절). */
  await 누르기(앱().locator('#shList .ms-it', { hasText: '화학사고' }).first(), { 뒤: 1300 });
  표시('01고름', { 자리: await 줄까지(앱().locator('#shList .ms-it.on').first(), '.l1, .l6, .l2') });
  await 머묾(3400);
  표시('01지도');
  await 보이게(찾기('.mmap'));                                                   // 고른 곳이 지도에
  await 머묾(3000);
  await 누르기('#btnToSms', { 뒤: 200, 표: '02누름' });
  await 넘어감(/\/sms\//);

  /* ⑤ 02 주민대피 문자생성기 — 넘겨받은 칸은 그대로 두고 나머지만 채움 */
  표시('02');
  await 머묾(900);
  표시('02받음', { 자리: await 자리('#seedBar') });
  await 머묾(2600);
  await 누르기('#stages button[data-s=evac]', { 뒤: 1100 });
  const 다음 = () => 누르기('#stepNav .sn-next', { 앞: 500, 뒤: 1000 });
  await 누르기('#types button[data-t="누출"]', { 뒤: 900 });
  await 다음();
  await 치기('#if_기관', '여수시', 240);
  await 누르기('#if_시각', { 뒤: 300 });
  await 찾기('#if_시각').fill(가상사고.시각);
  await 잠깐(700);
  await 다음();
  if (!(await 찾기('#if_시군').inputValue().catch(() => ''))) await 치기('#if_시군', '여수시', 240);
  if (!(await 찾기('#if_읍면동').inputValue().catch(() => ''))) await 치기('#if_읍면동', '주삼동', 240);
  await 치기('#if_사업장', 가상사고.사업장, 260);
  await 다음();
  await 치기('#if_대상지역', '주삼동 일원', 240);
  await 다음();
  await 치기('#if_물질', 가상사고.물질, 260);
  await 잠깐(400);
  const 물질줄 = 앱().locator('.mpk-row', { hasText: 가상사고.물질 }).first();
  await 누르기((await 물질줄.count()) ? 물질줄 : 앱().locator('.mpk-row').first(), { 뒤: 900 });
  await 다음();
  await 머묾(900);
  await 다음();                                                                 // 대피장소 — 넘겨받은 그대로
  await 맨위로(600);
  const 문안 = 앱().locator('#out .out:not(.bad) .msg').first();
  if (!(await 문안.count())) 문제.push('02 — 문안이 만들어지지 않음(빈칸이 남음)');
  표시('02문안', { 자리: await 자리(문안), 글: (await 문안.innerText().catch(() => '')).replace(/\s+/g, ' ') });
  await 머묾(4500);
  await 누르기('#out .out:not(.bad) footer button.p', { 뒤: 400, 표: '02복사' });
  await 머묾(3200);
  표시('끝');
  await 잠깐(600);

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
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', 원본영상]);
  const 상대 = (t) => +(t - t0).toFixed(3);
  const 기록 = {
    설명: '「사고 흐름 판」 휴대전화 화면 녹화본의 장면 시각(초 · 영상의 0초 기준). make_flow_video_long.mjs 가 씁니다.',
    녹화한날: new Date().toISOString(), 화면, 배경지도타일: 타일, 상황실코드: path.relative(RPATH, 상황실폴더),
    가상사고, 사고, 내위치: { lat: 북동700.latitude, lon: 북동700.longitude },
    표: 표.map((m) => ({ ...m, t: 상대(m.t) })),
    누름: 누름.map((m) => ({ ...m, t: 상대(m.t) })),
    문제,
  };
  writeFileSync(원본표, JSON.stringify(기록, null, 1));
  console.log(`녹화 ${((끝 - 시작) / 1000).toFixed(1)}초 · 장면 ${시각들.length}장 · 배경지도 타일 ${타일}장`);
  for (const m of 기록.표) console.log(`  ${String(m.t.toFixed(2)).padStart(7)}  ${m.k}${m.글 ? ' — ' + m.글 : ''}`);
  if (문제.length) { console.error('⚠ 고칠 것\n  ' + 문제.join('\n  ')); process.exit(1); }
}

/* ══════════════════════════════════════════════════════════════
   엮기 — 가상 사고 장면 + 녹화본(실제 빠르기) + 마무리. 자막·사고 카드·타이머·돋보기·음악.
   ══════════════════════════════════════════════════════════════ */
async function 엮기() {
  if (!existsSync(원본영상) || !existsSync(원본표)) throw new Error('녹화본이 없습니다 — 먼저 `녹화` 를 돌리세요');
  const 기록 = JSON.parse(readFileSync(원본표, 'utf8'));
  if (기록.문제 && 기록.문제.length) console.warn('⚠ 녹화 기록에 고칠 것이 남아 있습니다: ' + 기록.문제.join(' / '));
  const 때 = (k) => {
    const m = 기록.표.find((x) => x.k === k);
    if (!m) throw new Error('녹화 기록에 없는 표시: ' + k);
    return m;
  };
  const r = (k, 더 = 0) => 때(k).t + 더;

  /* 영상의 짜임 — 두 판
     · 짧은 판(기본 · 39초 · 2026-11-23 사용자 — "시계가 3분20초로 뜨는 것은 좋아. 하지만 영상은 30~40초 여야해 …
       발표시간은 고작 5분"): 녹화(사람 빠르기 · 3분 남짓)를 빠르게 돌려 엮습니다. 흐름 판과 같은 방식 —
       장면마다 **끝나는 시각만** 정하고(120 BPM 마디 첫 박 · 음악의 큰 북 자리), 장면 안의 조각은
       [녹화 시작, 녹화 끝, 무게] 로 길이를 나눕니다. 읽어야 하는 대목(협의업체 · 상황실 전화 · 구역 판정 ·
       넘겨받음 · 문안)은 무게를 높여 천천히, 치고 누르는 대목은 빠르게. **실제보다 느리게는 돌리지 않습니다**
       — 넘치는 몫은 다른 조각에 돌립니다. 상황실 전화를 누르는 순간은 무게를 크게 둬 실제 빠르기(1배)입니다.
     · 긴 판(--길게 · 3분 남짓): 녹화를 실제 빠르기로(장면 길이를 반 박으로 내림). 처음에 만든 판입니다.
     타이머는 두 판 모두 **녹화된 그 장면의 실제 시각** — 빨리 돌린 구간은 「○배 빠르게」를 함께 띄웁니다. */
  const 길게 = process.argv.includes('--길게');
  const 판 = 길게
    ? { 인트로: 8, 마무리: 8, 때: { 태그: 0.3, 제목: 1.0, 줄1: 1.7, 줄2: 2.3, 줄임: 4.9, 줄임길이: 0.9, QR: 5.8 } }
    : { 인트로: 4, 마무리: 3, 때: { 태그: 0.15, 제목: 0.5, 줄1: 0.9, 줄2: 1.25, 줄임: 2.7, 줄임길이: 0.6, QR: 3.2 } };
  const 인트로 = 판.인트로;
  const 낼곳 = 길게 ? 낼.replace(/\.mp4$/, '_길게.mp4') : 낼;
  const 나누기 = (조각, D) => {
    const 몫 = 조각.map(() => null);
    for (;;) {
      const 남은 = 조각.map((g, i) => i).filter((i) => 몫[i] == null);
      if (!남은.length) break;
      const 쓸 = D - 몫.reduce((x, y) => x + (y || 0), 0);
      const 합 = 남은.reduce((x, i) => x + 조각[i][2] * (조각[i][1] - 조각[i][0]), 0);
      const 넘침 = 남은.filter((i) => 쓸 * 조각[i][2] * (조각[i][1] - 조각[i][0]) / 합 > 조각[i][1] - 조각[i][0]);
      if (!넘침.length || 넘침.length === 남은.length) {
        남은.forEach((i) => { 몫[i] = 쓸 * 조각[i][2] * (조각[i][1] - 조각[i][0]) / 합; });
        break;
      }
      넘침.forEach((i) => { 몫[i] = 조각[i][1] - 조각[i][0]; });   // 실제 길이 그대로(1배)
    }
    return 몫;
  };
  // 01 에서 대피장소를 고른 뒤 지도로 내려가는 때(예전 녹화에는 표시가 없어 고른 때 + 3.3초)
  const 지도때 = () => { const m = 기록.표.find((x) => x.k === '01지도'); return m ? m.t : r('01고름', 3.3); };
  const 장면들 = 길게
    ? [['접속', 0], ['03누름', 0.1], ['04누름', 0.1], ['01누름', 0.1], ['02누름', 0.1], ['끝', 0.3]]
        .slice(0, -1).map((k, i, all) => {
          const a = r(...k), b = i + 1 < all.length ? r(...all[i + 1]) : r('끝', 0.3);
          return { 길이: Math.max(0.5, Math.floor((b - a) / 0.5 + 1e-6) * 0.5), 조각: [[a, b, 1]] };
        })
    : [
      { 끝: 6, 조각: [[r('접속'), r('03누름', 0.1), 1]] },
      { 끝: 16, 조각: [[r('03누름', 0.1), r('03목록', -0.3), 1],
                       [r('03목록', -0.3), r('03전화', -0.15), 5],            // 협의업체 맨 위 · 상황실 줄
                       [r('03전화', -0.15), r('03전화', 2.4), 30],            // 상황실 전화 — 실제 빠르기
                       [r('03전화', 2.4), r('03물품'), 1],                   // 세부 창 · 동원 목록
                       [r('03물품'), r('04누름', 0.1), 1]] },                 // 방제물품(흡착포)
      { 끝: 24, 조각: [[r('04누름', 0.1), r('04판정', -0.3), 1], [r('04판정', -0.3), r('04표'), 6],
                       [r('04표'), r('01누름', 0.1), 1]] },
      { 끝: 30, 조각: [[r('01누름', 0.1), r('01받음', -0.2), 1], [r('01받음', -0.2), r('01목록으로'), 4],
                       [r('01목록으로'), r('01고름', -0.2), 1], [r('01고름', -0.2), 지도때(), 6],   // 고른 대피장소 줄
                       [지도때(), r('02누름', 0.1), 1]] },
      { 끝: 36, 조각: [[r('02누름', 0.1), r('02문안', -0.3), 1], [r('02문안', -0.3), r('02복사'), 5],
                       [r('02복사'), r('끝', 0.3), 5]] },
    ];
  const 구간 = [];
  const 장면시작 = [];
  let 누적 = 인트로;
  for (const 장 of 장면들) {
    장면시작.push(누적);
    const D = 장.길이 != null ? 장.길이 : 장.끝 - 누적;
    const 몫 = 나누기(장.조각, D);
    장.조각.forEach(([a, b], i) => {
      if (b <= a) throw new Error(`구간 순서가 이상합니다: ${a} → ${b}`);
      구간.push({ a, b, d: 몫[i], s: 누적, 배: (b - a) / 몫[i] });
      누적 += 몫[i];
    });
  }
  for (const g of 구간) if (g.배 < 0.98) console.warn(`⚠ 녹화가 짧아 실제보다 느리게 돕니다(×${g.배.toFixed(2)}) — 녹화의 기다림을 늘리세요`);
  const 내용끝 = 누적;
  const 길이 = Math.round((내용끝 + 판.마무리) * 2) / 2;
  const 장면 = { 방제: 장면시작[1], 안전: 장면시작[2], 대피: 장면시작[3], 문자: 장면시작[4], 끝: 내용끝 };
  const 원점 = r('접속');
  const 원시각 = (t) => {
    if (t < 인트로) return null;
    for (const g of 구간) if (t < g.s + g.d) return g.a + (t - g.s) * g.배;
    return 구간[구간.length - 1].b;
  };
  const 영상시각 = (rt) => {
    for (const g of 구간) if (rt >= g.a && rt < g.b) return g.s + (rt - g.a) / g.배;
    return null;
  };
  const 배속 = (t) => { for (const g of 구간) if (t >= g.s && t < g.s + g.d) return g.배; return 1; };
  console.log('구간', 구간.map((g) => `${g.s.toFixed(1)}~${(g.s + g.d).toFixed(1)}초 ×${g.배.toFixed(2)}`).join(' · '));
  console.log(`영상 ${길이.toFixed(1)}초 · 녹화(시계) ${(r('끝', 0.3) - 원점).toFixed(1)}초`);

  const 작업 = path.join(RPATH, 길게 ? '.narr/사고흐름엮기_길게' : '.narr/사고흐름엮기');
  if (!미리) rmSync(작업, { recursive: true, force: true });
  mkdirSync(path.join(작업, '폰'), { recursive: true });
  mkdirSync(path.join(작업, '장면'), { recursive: true });

  /* 1) 휴대전화 화면 — 구간마다 빠르기를 맞춰 이어 붙임(영상 시각 그대로의 사진들) */
  if (!미리 || !readdirSync(path.join(작업, '폰')).length) {
    const 거르개 = 구간.map((g, i) =>
      `[0:v]trim=start=${g.a.toFixed(3)}:end=${g.b.toFixed(3)},setpts=(PTS-STARTPTS)/${g.배.toFixed(5)},fps=${FPS}[v${i}]`).join(';')
      + ';' + 구간.map((g, i) => `[v${i}]`).join('') + `concat=n=${구간.length}:v=1:a=0[out]`;
    execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', 원본영상, '-filter_complex', 거르개,
      '-map', '[out]', '-q:v', '3', path.join(작업, '폰', '%05d.jpg')]);
  }
  const 폰장수 = readdirSync(path.join(작업, '폰')).length;

  /* 2) 자막 — [영상 초, 자막, 이름표, 덧글]. 화면에 실제로 나오는 것만 말합니다.
     짧은 판은 한 장면에 한두 문장 — 빠르게 돌아가는 화면 위에서 읽을 틈이 있어야 합니다. */
  const V = (k, 더 = 0) => { const v = 영상시각(r(k, 더)); if (v == null) throw new Error('영상 밖 표시: ' + k); return v; };
  const 이03 = '03 방제 물품·장비 찾기', 이04 = '04 현장 안전거리 확인', 이01 = '01 주민 대피장소 찾기', 이02 = '02 주민대피 문자생성기';
  const 자막 = 길게 ? [
    [판.때.QR, '설치·회원가입 없이\nQR 하나로 접속', '', ''],
    [장면.방제, '무엇으로 막을까?', 이03, '업체 섭외 → 수집·운반'],
    [V('03찍음', -0.6), '사고지점을 찍으면\n가까운 순으로', 이03, ''],
    [V('03목록', -0.4), '미리 협의된 업체가\n맨 위에', 이03, ''],
    [V('03전화줄', -0.2), '비상연락망은\n상황실로 바로 전화', 이03, '누르면 안전원 상황실로 걸림'],
    [V('03세부', -0.8), '연락처·허가 현황을\n한 창에', 이03, ''],
    [V('03담음', -0.6), '동원할 곳은\n목록에 담아 두고', 이03, ''],
    [V('03물품'), '필요한 물품도\n가까운 순으로', 이03, '방제물품 찾기 → 흡착포'],
    [V('03물품목록', -0.4), '가진 곳 · 거리 ·\n보유 수량', 이03, ''],
    [장면.안전, '내 자리는 안전한가?', 이04, '물질 · 사고지점 · 바람'],
    [V('04구역', -0.3), '바람을 고르면\n구역이 지도에', 이04, ''],
    [V('04판정', -0.3), '내 위치가\n구역 안인지 바로', 이04, ''],
    [V('04표', -0.4), '물질별 안전거리 표', 이04, '물질정보의 ERG 거리'],
    [장면.대피, '어디로 대피시킬까?', 이01, '04에서 정한 사고지점·물질 그대로'],
    [V('01목록으로', 0.2), '가까운 대피장소를\n거리순으로', 이01, ''],
    [장면.문자, '무엇을 알릴까?', 이02, '01에서 고른 대피장소·지역 그대로'],
    [V('02문안', -0.3), '승인받은 표준문안\n자동 생성', 이02, ''],
    [V('02복사', -0.2), '복사해 그대로\n발송 시스템으로', 이02, ''],
    [내용끝, '방제부터 대피 문자까지,\n휴대전화 하나로', '', ''],
  ] : [
    [판.때.QR, '설치·회원가입 없이\nQR 하나로 접속', '', ''],
    [장면.방제, '무엇으로 막을까?', 이03, '업체 섭외 → 수집·운반'],
    [V('03목록', -0.3), '미리 협의된 업체가\n맨 위에', 이03, ''],
    [V('03전화', -0.9), '비상연락망은\n상황실로 바로 전화', 이03, '누르면 안전원 상황실로 걸림'],
    [V('03물품'), '필요한 물품도\n가까운 순으로', 이03, '방제물품 찾기 → 흡착포'],
    [장면.안전, '내 자리는 안전한가?', 이04, ''],
    [V('04판정', -0.3), '내 위치가\n구역 안인지 바로', 이04, ''],
    [장면.대피, '어디로 대피시킬까?', 이01, '04에서 정한 사고지점·물질 그대로'],
    [V('01고름', -0.2), '가까운 대피장소를\n거리순으로', 이01, ''],
    [장면.문자, '무엇을 알릴까?', 이02, '01에서 고른 대피장소·지역 그대로'],
    [V('02문안', -0.3), '승인받은 표준문안\n자동 생성', 이02, ''],
    [V('02복사', -0.1), '복사해 그대로\n발송 시스템으로', 이02, ''],
    [내용끝, '방제부터 대피 문자까지,\n휴대전화 하나로', '', ''],
  ];
  for (let i = 1; i < 자막.length; i++) if (자막[i][0] <= 자막[i - 1][0] + 0.6) console.warn('⚠ 자막이 너무 빨리 바뀝니다: ' + 자막[i][1].replace('\n', ' '));
  /* 돋보기 — [표시, 녹화에서 몇 초 뒤부터, 영상에서 길게는 몇 초, 상황실 전화 표시, 자리 이름].
     다음 누름 전에 끝냅니다(누르면 그 자리가 바뀜) — 상황실 줄은 그 줄을 누르는 동안에도 둡니다. */
  const 다음누름 = (rt) => { const m = 기록.누름.find((x) => x.t > rt + 0.02); return m ? m.t : Infinity; };
  const 돋목록 = 길게
    ? [['03목록', 0.2, 2.8, false], ['03전화줄', 0.1, 6.0, true], ['03물품목록', 0.2, 2.8, false],
      ['03물품세부', 0.2, 3.6, false], ['04판정', -0.2, 4.0, false], ['04표', 0.2, 3.2, false],
      ['01받음', 0.1, 3.2, false], ['01고름', 0.1, 3.2, false], ['02문안', 0.1, 4.2, false]]
    : [['03목록', 0.1, 9, true, '머리'], ['04판정', -0.2, 3.6, false], ['01받음', 0.0, 2.2, false],
      ['01고름', 0.05, 2.0, false], ['02문안', 0.05, 2.6, false]];
  const 돋보기 = 돋목록.map(([k, 덧, 최대, 전화, 이름]) => {
    const 시작 = 영상시각(r(k, 덧));
    const z = 때(k)[이름 || '자리'] || 때(k).자리;
    if (시작 == null || !z) { console.warn('돋보기 빠짐: ' + k); return null; }
    const 기준 = 전화 ? r('03전화') : r(k, 덧);
    let 끝 = 영상시각(다음누름(기준));
    // 짧은 판의 상황실 줄 — 실제 빠르기 구간이 끝나면(목록을 굴리기 시작) 함께 끝냄: 굴러가는 화면이 비치지 않게
    if (전화 && !길게) 끝 = Math.min(끝 == null ? Infinity : 끝, V('03전화', 2.3));
    // 고른 대피장소 줄 — 화면이 지도로 내려가기 전에 끝냄(내려간 뒤에는 그 자리에 다른 것이 비침)
    if (k === '01고름') {
      const 내림 = 기록.표.find((x) => x.k === '01지도');
      끝 = Math.min(끝 == null ? Infinity : 끝, 영상시각(내림 ? 내림.t : r('01고름', 3.3)) ?? Infinity);
    }
    return { s: 시작, d: Math.max(0.6, Math.min(최대, 끝 != null && isFinite(끝) ? 끝 - 0.05 - 시작 : 최대)), z, 전화 };
  }).filter(Boolean);
  const 전화때 = V('03전화');
  console.log('돋보기', 돋보기.map((z) => `${z.s.toFixed(1)}초부터 ${z.d.toFixed(1)}초`).join(' · '));
  const 뒤로때 = 영상시각(r('뒤로'));
  const 누름자국 = 기록.누름.map((m) => ({ t: 영상시각(m.t), x: m.x, y: m.y })).filter((m) => m.t != null);

  /* 3) 음악 — 장면 경계에 부드러운 북 · 자막이 바뀌는 자리에 작은 북 · 상황실 전화에 종 */
  const 음악 = path.join(작업, '음악.wav');
  if (!미리) execFileSync(process.env.PYTHON || 'python3', [path.join(RPATH, 'build/make_flow_music_long.py'), 음악,
    JSON.stringify({ 길이, 사고: 판.때.제목, 줄임: 판.때.줄임, QR: 판.때.QR, 접속: 인트로,
      큰북: [장면.방제, 장면.안전, 장면.대피, 장면.문자],
      작은북: 자막.slice(1, -1).map((x) => x[0]).filter((t) => ![장면.방제, 장면.안전, 장면.대피, 장면.문자].includes(t)),
      전화: 전화때, 끝북: 내용끝 })], { stdio: 'inherit' });

  const 쉬움 = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const 상태 = (t) => {
    let 자 = null;
    for (const s of 자막) if (t >= s[0]) 자 = s;
    const rt = 원시각(t);
    const 끝남 = t >= 내용끝;
    const 경과 = 끝남 ? r('끝', 0.3) - 원점 : rt == null ? 0 : Math.max(0, rt - 원점);
    let 돋 = null;
    for (const z of 돋보기) {
      if (t >= z.s && t < z.s + z.d) 돋 = { ...z.z, a: Math.min(쉬움((t - z.s) / 0.3), 쉬움((z.s + z.d - t) / 0.3)),
        전화: z.전화 ? Math.max(0, t - 전화때) : -1 };
    }
    const 폰i = Math.min(폰장수, Math.max(1, Math.floor((Math.min(t, 내용끝 - 0.001) - 인트로) * FPS) + 1));
    return {
      t, 인트로, 자막: 자 ? 자[1] : '', 이름표: 자 ? 자[2] : '', 덧글: 자 ? 자[3] : '',
      자막보임: 자 ? 쉬움((t - 자[0]) / 0.35) : 0, 자막끝: 끝남,
      폰: t >= 인트로 ? 'file://' + path.join(작업, '폰', String(폰i).padStart(5, '0') + '.jpg') : null,
      폰보임: 쉬움((t - 인트로 + 0.2) / 0.5),
      경과, 배: 끝남 || rt == null ? 1 : 배속(t), 돋,
      누름: 누름자국.filter((m) => t >= m.t && t < m.t + 0.45).map((m) => ({ x: m.x, y: m.y, a: (t - m.t) / 0.45 })),
      뒤로: 뒤로때 != null && t >= 뒤로때 - 0.1 && t < 뒤로때 + 0.9,
      끝: 쉬움((t - 내용끝) / 0.6), 어둡게: Math.max(0, (t - (길이 - 0.5)) / 0.5),
    };
  };

  /* 4) 무대를 한 장씩 찍음 */
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(RPATH, 'build/영상_사고흐름무대.html'));
  await page.evaluate((o) => window.준비(o), {
    qr: 'file://' + path.join(RPATH, 'docs/QR/QR_접속.svg'), 폭: 기록.화면.width, 높이: 기록.화면.height,
    사고: 기록.가상사고 || 가상사고, 때: 판.때,
  });
  if (미리) {
    for (const t of 미리) {
      await page.evaluate((s) => window.장면(s), 상태(t));
      const f = path.join(작업, `미리_${t}.png`);
      await page.screenshot({ path: f });
      console.log('찍음', f);
    }
    await browser.close();
    return;
  }
  const 장수 = Math.round(길이 * FPS);
  for (let k = 0; k < 장수; k++) {
    await page.evaluate((s) => window.장면(s), 상태(k / FPS));
    await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (k % 600 === 0) console.log(`찍는 중 ${k}/${장수}`);
  }
  await browser.close();

  /* 5) 사진 + 음악 → mp4. 울림은 줌인 판과 같은 넓게 퍼지는 네 겹(60~270ms) — 짧은 되울림(45·95ms)은
     북소리 뒤에 '딱' 을 한 번 더 붙여 총소리처럼 들리게 했습니다(2026-11-22 사용자). */
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS),
    '-i', path.join(작업, '장면', 'f%05d.jpg'), '-i', 음악,
    '-filter_complex', '[1:a]aecho=0.8:0.7:60|120|190|270:0.12|0.09|0.06|0.04,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', process.env.FFPRESET || 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 낼곳]);
  console.log(`만듦 ${낼곳} — ${길이.toFixed(1)}초 · 시계(녹화 경과) ${(r('끝', 0.3) - 원점).toFixed(1)}초`);
}
