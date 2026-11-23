/* 결선 발표용 「사고 흐름 판 3」(영상 46초 · 시계는 2분 57초에서 멈춤) — 녹화 · 조립
   ───────────────────────────────────────────────────────────────
       node build/make_flow_video_long.mjs 녹화 --사이트 .narr/배포판 --상황실 .narr/배포판
       node build/make_flow_video_long.mjs 엮기                         # → docs/공모전_결선_사고흐름3.mp4 · _첫장.png
       node build/make_flow_video_long.mjs 둘다 --사이트 .narr/배포판 --상황실 .narr/배포판
       node build/make_flow_video_long.mjs 엮기 --미리 0,1.5,40          # 그 순간만 사진으로(무대를 고칠 때)

   ── 3판에서 바꾼 것 (2026-11-23 저녁 사용자) ─────────────────────────
   · **첫 장면 = 접속 화면**("인트로 사진이 내가 원하던 건 저게 아니라 … 수정1 화면이야. 그냥 저 화면에서 QR 코드만
     선명하게 보이도록, 다른 부가설명은 필요 없어 … 그대로 저 화면에서 영상이 재생되도록"). 2판의 번호 단 화면
     구성(PPT 한 장 같은 첫 장)은 걷어냈습니다. 0초에 왼쪽 위 작은 사고 카드 · 「설치·회원가입 없이 QR 하나로
     접속」 · 흰 바탕 QR · 휴대전화 첫 화면 · 시계 0:00.0 이 다 떠 있어 PPT 에서 재생 전에 그대로 보입니다.
   · 가상 사고(크게 뜨는 카드)는 그 **뒤**에("수정2 의 장면이 뒤로 밀려나서 수정1 의 화면 이후에") — 재생하면 작은
     카드가 가운데로 커졌다가(나머지는 잠깐 물러남) 다시 왼쪽 위로 가고, 휴대전화가 움직이기 시작합니다.
   · **시계는 2분 57초에서 멈추고 그 장에서 영상이 끝납니다**("시연 시간이 3분을 넘기면 안 될 것 같아. 2분 57초에
     끊어지도록 … 시간은 멈췄는데 영상이 2~3초 더 진행 … 바로 끊기는 게 좋은 것 같아"). 마무리 장면이 없습니다.
     시계는 늘 녹화의 실제 경과라 숫자를 고치지 않고 **녹화를 조금 당겼습니다**(아래 머묾) — 2판은 3분 14초였습니다.
   · 화면은 **지금 배포된 서비스**(작업 가지 hsgoit · 커밋 8e9468e)에서 녹화합니다. 그 판에 최종본의 차례·이름과
     방제 화면의 상황실 줄이 함께 들어가, 2판처럼 두 커밋을 섞을 까닭이 없어졌습니다(두 인자에 같은 폴더).
   · 앞의 판들(사고흐름.mp4 · 사고흐름2.mp4)은 **그대로 둡니다** — 이 판은 파일을 따로 씁니다.

   ── 2판에서 정한 것(그대로) ───────────────────────────────────────
   · 차례·이름은 서비스 최종본 — **01 현장 안전거리 확인 → 02 주민 대피장소 찾기 → 03 주민대피 문자생성기 →
     04 방제 물품·장비 찾기**(현장 대응 순서) · **화학사고 초동대응 현장 지원 서비스**.
   · 방제 장면의 확대는 **맨 위 협의업체 줄 통째로**(협의 딱지 · 비상연락망 · 업체 · 거리 · 주소 · 처리가능
     폐기물 · 확인 못 한 것). 사용자 — "상황실 전화연결부분은 보이기만 하면 되는 거고 강조를 해야 하는 것은
     아닌 거야." → 상황실 링크를 **누르지 않고**, 전화 표시·종소리·1배 구간도 뺐습니다.

   ── 지키는 것 ─────────────────────────────────────────────────
   · 휴대전화 안은 **실제 서비스**입니다. 무대는 테두리 · 사고 카드 · 자막 · 타이머 · 확대만 맡습니다.
   · 방제 화면은 `--상황실` 폴더의 코드로 엽니다(아래 서버 · 2판에서는 상황실 줄이 a869d46 에만 있었음). 3판은
     배포판 하나로 두 인자를 같게 줍니다 — 영상과 실제 사이트가 같습니다.
   · 업체명·전화번호는 흐립니다. **안전원 상황실 번호만은 흐리지 않습니다**(업체·담당자 번호가 아님).
   · 문자는 **만들고 복사**합니다 — 이 서비스가 문자를 직접 보내지 않으므로 자막도 「복사해 그대로 발송 시스템으로」.
   · 사고지점은 01·04 에서 같은 좌표(`사고`), 내 위치는 북동쪽 700m · 남서풍 → 「방호활동 구역 안」.
     어긋나면 녹화가 멈춥니다. 04 방제는 사고지점을 넘겨받지 않아 다시 찾습니다 — 끝 자막에 「입력 한 번」을
     쓰지 않습니다.

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
const 사이트폴더 = 인자값('--사이트') ? path.resolve(인자값('--사이트')) : null;
const 미리 = 인자값('--미리') ? 인자값('--미리').split(',').map(Number) : null;
const 원본방 = path.join(RPATH, 'source/녹화');
const 원본영상 = path.join(원본방, '사고흐름3_원본.mp4');
const 원본표 = path.join(원본방, '사고흐름3_원본.json');
const 낼 = path.join(RPATH, 'docs/공모전_결선_사고흐름3.mp4');
const 첫장 = path.join(RPATH, 'docs/공모전_결선_사고흐름3_첫장.png');
/* 시연 시계가 멈추는 자리 — 2분 57초(2026-11-23 사용자 — "시연 시간이 3분을 넘기면 안 될 것 같아. 2분 57초에
   끊어지도록"). 영상도 그 순간에 끝납니다. */
const 시연끝초 = 177.0;
const ff = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const 화면 = { width: 390, height: 800 };   // 휴대전화 화면(css px) — 무대의 휴대전화 틀과 같은 비율

/* 가상 사고 — 무대의 사고 카드와 03 문자 장면에 같은 값을 씁니다 */
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

if (!['녹화', '엮기', '둘다'].includes(모드)) { console.error('쓰는 법: 녹화 | 엮기 | 둘다 [--사이트 폴더 --상황실 폴더]'); process.exit(2); }
if (모드 === '녹화' || 모드 === '둘다') await 녹화();
if (모드 === '엮기' || 모드 === '둘다') await 엮기();

/* ══════════════════════════════════════════════════════════════
   녹화 — 휴대전화 화면만 받습니다. 장면마다 받은 시각을 적어 두어 타이머가 실제 시각을 띄웁니다.
   ══════════════════════════════════════════════════════════════ */
async function 녹화() {
  if (!상황실폴더 || !existsSync(path.join(상황실폴더, 'res/app.js')))
    throw new Error('--상황실 폴더가 필요합니다 — 배포판(상황실 줄이 있는 방제 화면)을 꺼내세요: git worktree add --detach .narr/배포판 8e9468e');
  if (!/rk-emg-tel/.test(readFileSync(path.join(상황실폴더, 'res/app.js'), 'utf8')))
    throw new Error('--상황실 폴더의 방제 화면에 「안전원 상황실」 줄이 없습니다(배포판 8e9468e 또는 a869d46 을 꺼내세요)');
  if (!사이트폴더 || !existsSync(path.join(사이트폴더, 'index.html')))
    throw new Error('--사이트 폴더가 필요합니다 — git worktree add --detach .narr/배포판 8e9468e(배포된 서비스)');
  if (!/초동대응 현장 지원 서비스/.test(readFileSync(path.join(사이트폴더, 'index.html'), 'utf8')))
    throw new Error('--사이트 폴더가 최종본이 아닙니다(서비스 이름이 「화학사고 초동대응 현장 지원 서비스」가 아님)');
  const 작업방 = path.join(RPATH, '.narr/사고흐름3녹화');
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
  /* 방제 화면만 상황실 줄이 있는 코드에서 — 방제 문서와, 그 문서가 부르는 것(스타일·자료·스크립트)을
     그 폴더에서 냅니다. 누가 불렀는지는 Referer 로 압니다(같은 출처라 전체 주소가 옵니다).
     나머지(첫 화면 · 안전거리 · 대피장소 · 문자)는 최종본(`--사이트`) 그대로입니다. */
  const 뿌리 = (q, u) => {
    let 부른 = '';
    try { 부른 = new URL(q.headers.referer || '').pathname; } catch (e) { /* 없음 */ }
    return u.startsWith('/res/') || 부른.startsWith('/res/') ? 상황실폴더 : 사이트폴더;
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
  /* 머묾 — 사람이 화면을 읽는 틈. 누르기 전 틈·글자 치는 속도와 함께 **사람이 실제로 하는 빠르기**에
     맞춥니다. 영상은 그 녹화를 빠르게 돌리고 「○배 빠르게」를 띄웁니다.
     3판(2026-11-23 저녁)에서 조금 당겼습니다 — 2판은 3분 14초가 걸렸는데 사용자가 "시연 시간이 3분을 넘기면
     안 될 것 같아. 2분 57초에" 라고 했습니다. 시계는 늘 녹화의 **실제 경과**라, 숫자를 고치지 않고 녹화 자체를
     당깁니다(읽는 틈 ×1.12 → ×0.95 · 누르기 전 0.65 → 0.5초 · 글자 0.24 → 0.19초). 남는 몫은 마지막 세부 창을
     읽는 틈으로 씁니다(아래 「끝」). */
  const 잠깐 = (ms) => p.waitForTimeout(ms);
  /* 읽는 틈의 배율은 **녹화하면서 맞춥니다** — 러너와 개발 자리는 빠르기가 달라(타일 기다림 등) 한 숫자로 못 박으면
     2분 57초를 넘기거나 끝에 빈 시간이 길게 남습니다. 앞 절반은 0.85 로 가고, 두 곳(첫 화면으로 돌아갈 때 · 방제물품으로
     바꿀 때)에서 지금까지 걸린 시간으로 남은 틈의 배율을 다시 정합니다(`맞추기`). 마지막 세부 창 읽는 틈이 나머지를 받습니다. */
  let 배율 = 0.85;
  let 쉰합 = 0;                          // 실제로 쉰 틈(ms) — 걸린 시간에서 빼면 '누르고 기다린' 몫이 남음
  let 명목 = 0;                          // 배율을 곱하기 전 틈의 합(ms) — 맞추기에 적은 '남은 틈' 이 맞는지 셈
  const 머묾 = (ms) => { const d = Math.round(ms * 배율); 쉰합 += d; 명목 += ms; return 잠깐(d); };
  const 글자배율 = 0.75;
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
  const 톡 = async (x, y, { 앞 = 450, 뒤 = 850, 표: 이름 } = {}) => {
    await 잠깐(앞);
    if (이름) 표시(이름);
    누름.push({ t: Date.now() / 1000, x, y });
    await p.touchscreen.tap(x * 틀, y * 틀);
    await 잠깐(뒤);
  };
  const 누르기 = async (대상, { 앞 = 450, 뒤 = 850, 표: 이름 } = {}) => {
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
    await 찾기(칸).pressSequentially(값, { delay: Math.round(속도 * 글자배율) });
    await 잠깐(500);
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
    await 톡(g.cx + dx, g.cy + dy, { 앞: 500, 뒤: 1100 });
  };
  const 찍힌자리 = async () => {
    const v = await 앱().evaluate(() => [document.querySelector('#acLat'), document.querySelector('#acLon')]
      .map((e) => (e ? parseFloat(e.value) : NaN)));
    return isFinite(v[0]) && isFinite(v[1]) ? { lat: v[0], lon: v[1] } : null;
  };
  /* 방제 — 사고지점을 '주삼동' 으로 찾아 같은 자리를 찍고 목록으로 내려감 */
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

  /* ① 접속 — 첫 화면(최종본 · 카드 넷이 01 안전거리 → 02 대피장소 → 03 문자 → 04 방제) */
  await p.goto(`${BASE}/__틀.html`, { waitUntil: 'load' });
  await 앱().evaluate(() => document.fonts.ready);
  const 카드차례 = await 앱().evaluate(() => [...document.querySelectorAll('li.pn a')].map((a) => a.getAttribute('href').split('/')[0]).join(','));
  if (카드차례 !== 'safe,map,sms,res') 문제.push('첫 화면 카드 차례가 최종본과 다름: ' + 카드차례);
  /* 시계는 첫 화면이 **다 그려진 뒤**부터 — 영상의 첫 장면(재생 전 화면)에 이 화면이 그대로 걸립니다. 카드 사진이
     풀리기 전·제목 낱말이 올라오는 중(1초 남짓)에 시계를 시작했더니 첫 장면의 휴대전화가 회색 빈 카드였습니다. */
  await 앱().evaluate(() => Promise.race([
    Promise.all([...document.images].map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => {})))),
    new Promise((ok) => setTimeout(ok, 5000)),
  ]));
  await 잠깐(1300);
  표시('접속');
  const 접속때 = Date.now();              // 시연 시계의 0초 — 엮기의 원점(r('접속'))과 같은 자리
  /* 맞추기 — 세부 창이 「2분 57초 − 3.4초」 무렵에 뜨도록 남은 읽는 틈의 배율을 정합니다.
     남은 '누르고 기다리는' 몫은 앞 절반(접속 → 첫 화면으로)의 그 몫에 비율을 곱해 어림합니다. 비율은 개발 자리
     미리 녹화(2026-11-23)에서 잰 값입니다 — 처음으로 뒤 0.83 · 물품 뒤 0.34. 남은 틈의 합(ms)은 아래 머묾들의 합이라
     **머묾을 더하거나 빼면 함께 고치세요**(끝에서 맞는지 셉니다). */
  const 세부목표 = 시연끝초 - 0.4 - 3.0;
  let 앞몫 = null;
  const 맞추기 = (이름, 남은틈, 비율) => {
    const 걸림 = (Date.now() - 접속때) / 1000;
    if (앞몫 == null) 앞몫 = 걸림 - 쉰합 / 1000;
    const 새 = (세부목표 - 걸림 - 비율 * 앞몫) / (남은틈 / 1000);
    배율 = Math.min(1.4, Math.max(0.5, 새));
    console.log(`맞추기(${이름}) — ${걸림.toFixed(1)}초 · 앞 절반의 누르고 기다린 몫 ${앞몫.toFixed(1)}초 → 남은 틈 배율 ${배율.toFixed(2)}`);
    return { 명목, 남은틈 };
  };
  await 머묾(2400);                       // 첫 장면에서 이미 이 화면을 보여 주므로 짧게

  /* ② 01 현장 안전거리 확인 */
  await 누르기('li.pn a[href*="safe/"]', { 뒤: 200, 표: '안전누름' });
  await 넘어감(/\/safe\//);
  표시('안전');
  await 머묾(1600);
  await 치기('#sfMat', '암모니아', 250);
  await 누르기(앱().locator('.mpk:not(#addrPop) .mpk-row', { hasText: '암모니아' }).first(), { 뒤: 1000 });
  await 치기('#sfAddr', '주삼동');
  await 누르기(앱().locator('#addrPop .mpk-row', { hasText: '읍·면·동' }).first(), { 뒤: 1000 });
  await 타일기다리기();
  await 사고찍기('#map', await 동가운데('대피장소'));
  표시('안전찍음');
  await 머묾(1600);
  await 맨위로();
  await 누르기('#segSize button[data-v="l"]', { 뒤: 1200 });                    // 대규모
  await 누르기('#windBtn', { 뒤: 1300 });
  await 누르기('#windPop .wr-b[data-deg="225"]', { 뒤: 1100 });                  // 남서풍
  표시('안전구역');
  await 보이게(찾기('#map'));
  await 머묾(3000);                                                             // 구역이 그려진 지도
  await 맨위로();
  await 누르기('#btnWatch', { 뒤: 1600 });
  const 판정 = 앱().locator('#sfStat .sf-pt.me').first();
  if (!(await 앱().locator('#sfStat .sf-pt.me.pad, #sfStat .sf-pt.me.iso').count()))
    문제.push('01 안전거리 — 내 위치가 구역 안으로 나오지 않음');
  const 판정글 = (await 판정.innerText().catch(() => '')).replace(/\s+/g, ' ');
  /* 이 화면에는 좌표 칸이 없어, 판정 글의 「사고지점에서 ○m 북동쪽」 으로 사고지점이 제자리인지 봅니다(내 위치 = 북동 700m) */
  const 떨어짐 = /사고지점에서 ([\d,]+)m 북동쪽/.exec(판정글);
  if (!떨어짐 || Math.abs(+떨어짐[1].replace(/,/g, '') - 700) > 60) 문제.push('01 안전거리 — 사고지점이 어긋남: ' + 판정글);
  표시('안전판정', { 자리: await 자리(판정), 글: 판정글 });
  await 머묾(4200);
  /* 거리 표 — 물질정보의 ERG 거리 그대로 */
  const 표자리 = 앱().locator('#sfMore .sf-tbl').first();
  if (await 표자리.count()) {
    await 표자리.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await 잠깐(800);
    표시('안전표', { 자리: await 자리(표자리, 200) });
    await 머묾(3400);
  } else 문제.push('01 안전거리 — 거리 표가 없음');

  /* ③ 02 주민 대피장소 찾기 — 01 의 사고지점·물질을 그대로 받아 엶 */
  await 누르기('#goMap', { 뒤: 200, 표: '대피누름' });
  await 넘어감(/\/map\//);
  표시('대피');
  await 머묾(700);
  const 토스트 = (await 앱().locator('#mToast:not([hidden])').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (!/현장 안전거리 확인에서 정한 사고지점/.test(토스트)) 문제.push('02 대피장소 — 넘겨받았다는 안내가 안 보임: ' + 토스트);
  if ((await 앱().locator('#mMat').inputValue().catch(() => '')) !== '암모니아') 문제.push('02 대피장소 — 물질이 넘어오지 않음');
  const 찍대 = await 찍힌자리();
  if (!찍대 || 거리m(찍대, 사고) > 60) 문제.push('02 대피장소 — 사고지점이 어긋남: ' + JSON.stringify(찍대));
  /* 넘겨받았다는 안내는 지도 칸 아래쪽에 떠 「목록 보기」 단추 위로 오게 조금 내립니다(흐름 판과 같음) */
  const 내림 = await 앱().evaluate(() => {
    const t = document.querySelector('#mToast').getBoundingClientRect();
    return Math.max(0, t.bottom - (innerHeight - 84));
  });
  if (내림 > 0) { await 앱().evaluate((d) => scrollBy({ top: d, behavior: 'smooth' }), 내림); await 잠깐(700); }
  표시('대피받음', { 자리: await 자리('#mToast') });
  await 타일기다리기(2500);
  await 머묾(3400);
  await 목록으로('대피목록으로');
  await 머묾(1800);
  /* 화학사고 대피장소를 고릅니다 — 이재민 임시주거시설을 고르면 "실제 대피는 그쪽"처럼 읽힐 수
     있습니다(CLAUDE.md 7절). */
  await 누르기(앱().locator('#shList .ms-it', { hasText: '화학사고' }).first(), { 뒤: 1300 });
  표시('대피고름', { 자리: await 줄까지(앱().locator('#shList .ms-it.on').first(), '.l1, .l6, .l2') });
  await 머묾(3400);
  표시('대피지도');
  await 보이게(찾기('.mmap'));                                                   // 고른 곳이 지도에
  await 머묾(3000);
  await 누르기('#btnToSms', { 뒤: 200, 표: '문자누름' });
  await 넘어감(/\/sms\//);

  /* ④ 03 주민대피 문자생성기 — 넘겨받은 칸은 그대로 두고 나머지만 채움 */
  표시('문자');
  await 머묾(900);
  표시('문자받음', { 자리: await 자리('#seedBar') });
  await 머묾(2600);
  await 누르기('#stages button[data-s=evac]', { 뒤: 1100 });
  const 다음 = () => 누르기('#stepNav .sn-next', { 앞: 400, 뒤: 800 });
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
  if (!(await 문안.count())) 문제.push('03 문자 — 문안이 만들어지지 않음(빈칸이 남음)');
  표시('문자문안', { 자리: await 자리(문안), 글: (await 문안.innerText().catch(() => '')).replace(/\s+/g, ' ') });
  await 머묾(4500);
  await 누르기('#out .out:not(.bad) footer button.p', { 뒤: 400, 표: '문자복사' });
  await 머묾(3200);

  /* ⑤ 04 방제 물품·장비 찾기 — 첫 화면으로 돌아가(휴대전화의 '뒤로' 세 번) 04 카드를 누름.
     방제 화면은 사고지점을 넘겨받지 않아 여기서 다시 찾습니다(같은 좌표). */
  표시('처음으로');
  const 뒤시작 = 맞추기('처음으로', 24900, 0.83);   // 아래 머묾 1300·1600·2600·800·5600·3600·2400·1500·1800·700·3000
  await 앱().evaluate(() => history.go(-3));
  try { await 넘어감(/\/index\.html$/); }
  catch (e) { await 앱().goto(`${BASE}/index.html`); await 앱().waitForLoadState('load'); }
  await 머묾(1300);
  await 누르기('li.pn a[href*="res/"]', { 뒤: 200, 표: '방제누름' });
  await 넘어감(/\/res\//);
  표시('방제');
  await 머묾(1600);
  await 누르기('.rz-br >> nth=0', { 뒤: 1500 });                                  // 업체 섭외
  await 누르기(앱().locator('.rz-need', { hasText: '수집·운반' }).first(), { 뒤: 1200 });
  await 누르기('#rzNext', { 뒤: 1100 });
  await 방제사고지점('방제찍음');
  await 머묾(2600);                                                             // 지도 위 업체들
  await 목록으로('방제목록으로');
  await 머묾(800);
  const 협의줄 = 앱().locator('#shList .ms-it').filter({ has: 앱().locator('.tag.first') }).first();
  const 첫줄 = 앱().locator('#shList .ms-it').first();
  if (!(await 협의줄.count())) 문제.push('04 방제 — 미리 협의된 업체가 목록에 없음');
  else if (!(await 첫줄.locator('.tag.first').count())) 문제.push('04 방제 — 미리 협의된 업체가 맨 위가 아님');
  /* 맨 위 업체 줄 **통째로** — 협의 딱지 · 비상연락망(상황실) · 업체 · 거리 · 주소 · 처리가능 폐기물 ·
     확인 못 한 것(2026-11-23 사용자 — 상황실 번호만이 아니라 "업체 섭외를 저렇게 하면 되는구나"를
     보이게. 상황실 줄은 **보이기만** 하고 누르지 않습니다). */
  if (!(await 첫줄.locator('.rk-emg').count())) 문제.push('04 방제 — 맨 위 줄에 「비상연락망 ▶ 안전원 상황실」 줄이 없음');
  /* 아래 끝은 「확인 못 한 것」 줄까지(사용자가 빨간 상자로 짚은 자리) — 그 밑 전화 줄은 업체 번호라 흐려져 있고
     확대해 봐야 읽을 것이 없습니다 */
  const 줄조각 = '.l0, .l1, .ms-bar, .l6, .l2, .l7, .l8, .l5';
  const 통째 = await 줄까지(첫줄, 줄조각);
  const 줄높이 = await 첫줄.evaluate((el, q) => {
    let b = 0;
    el.querySelectorAll(q).forEach((c) => { b = Math.max(b, c.getBoundingClientRect().bottom); });
    return b - el.getBoundingClientRect().top;
  }, 줄조각).catch(() => 0);
  if (!통째 || 통째.h < 줄높이 - 4) 문제.push(`04 방제 — 맨 위 업체 줄이 화면에 다 안 들어옴(${통째 && Math.round(통째.h)} / ${Math.round(줄높이)})`);
  표시('방제목록', { 자리: 통째 });
  await 머묾(5600);
  /* 다른 업체들도 훑어봄 — 천천히 내렸다가 올림 */
  표시('방제굴림');
  await 굴리기(420, 2600);
  await 굴리기(-420, 1500);
  await 누르기(첫줄.locator('.l2').first(), { 뒤: 1300 });                       // 줄을 누르면 세부 창
  표시('방제세부');
  await 머묾(3600);
  await 누르기(앱().locator('#rkDet button', { hasText: '동원 목록에 담기' }).first(), { 뒤: 900 });
  if (!(await 앱().locator('#rMob:not([hidden]) .mob-n').count())) 문제.push('04 방제 — 동원 목록에 담기지 않음');
  표시('방제담음');
  await 머묾(2400);

  /* 04 방제물품 — 갈래를 바꾸려면 방제 화면을 처음부터(결과의 '조건 바꾸기'는 같은 갈래 안의 거르개) */
  표시('물품');
  const 물품시작 = 맞추기('물품', 7000, 0.34);                         // 아래 머묾 1500·1800·700·3000
  await 앱().evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* 없음 */ } location.reload(); });
  await 앱().waitForLoadState('load');
  await 머묾(1500);
  await 누르기('.rz-br >> nth=1', { 뒤: 1500 });                                  // 방제물품 찾기
  await 누르기(앱().locator('.rz-item', { hasText: '흡착포' }).first(), { 뒤: 1200 });
  await 누르기('#rzNext', { 뒤: 1100 });
  /* 물품 갈래의 찾기 목록에는 '주삼동' 이 없습니다(그 동에 물품을 가진 곳이 없어 색인에 안 들어감).
     내 위치(사고지점에서 북동 700m)로 지도를 연 뒤 조금 확대해 「사고지점 찍기」 로 **같은 사고지점**을
     다시 찍습니다 — 지도 가운데가 내 위치라 축척 막대로 셀 수 있습니다. */
  await 누르기('#startMe', { 뒤: 1800 });
  for (let i = 0; i < 5; i++) await 누르기('#zIn', { 앞: 200, 뒤: 380 });
  await 누르기('#btnAcc', { 뒤: 700 });
  await 사고찍기('.mmap', { lat: 북동700.latitude, lon: 북동700.longitude });
  표시('물품찍음');
  const 찍물 = await 찍힌자리();
  if (!찍물 || 거리m(찍물, 사고) > 60) 문제.push('04 방제물품 — 사고지점이 어긋남: ' + JSON.stringify(찍물));
  await 타일기다리기(2500);
  await 머묾(1800);
  await 목록으로('물품목록으로');
  await 머묾(700);
  표시('물품목록', { 자리: await 줄까지(앱().locator('#shList .ms-it').first(), '.l1, .l6, .l2, .l7') });
  await 머묾(3000);
  await 누르기(앱().locator('#shList .ms-it').first().locator('.l2').first(), { 뒤: 1300 });
  표시('물품세부', { 자리: await 줄까지(앱().locator('#rkDet .rkd-items').first(), 'li:nth-child(-n+3)') || await 자리('#rkDet .rkd', 220) });
  /* 끝 — 시연 시계가 2분 57초에서 멈추고 영상도 거기서 끝납니다(사용자 — "시간은 멈췄는데 영상이 2~3초 더
     진행 … 바로 끊기는 게 좋은 것 같아"). 남는 몫은 이 세부 창(흡착포 수량·연락처)을 읽는 틈으로 쓰고, 창을
     닫지 않고 끝냅니다 — 마지막 장면이 곧 찾은 결과입니다. 2분 57초를 넘기면 고칠 것으로 멈춥니다
     (배경지도가 없는 개발 자리는 타일을 기다리느라 늦으므로 알리기만 합니다). */
  const 여기까지 = (Date.now() - 접속때) / 1000;
  console.log(`세부 창 ${여기까지.toFixed(1)}초(목표 ${세부목표.toFixed(1)}초) · 남은 읽는 틈 ${(시연끝초 - 0.4 - 여기까지).toFixed(1)}초`);
  for (const [이름, 시작점] of [['처음으로', 뒤시작], ['물품', 물품시작]]) {
    if (명목 - 시작점.명목 !== 시작점.남은틈)
      console.warn(`⚠ 맞추기(${이름})에 적은 남은 틈 ${시작점.남은틈}ms 가 실제 머묾의 합 ${명목 - 시작점.명목}ms 와 다릅니다 — 숫자를 고치세요`);
  }
  await 잠깐(Math.max(2000, Math.round((시연끝초 - 0.4 - 여기까지) * 1000)));
  표시('끝');
  const 걸림 = (Date.now() - 접속때) / 1000;
  if (걸림 > 시연끝초 - 0.05) {
    const 말 = `시연이 ${걸림.toFixed(1)}초 — 2분 57초(${시연끝초}초)를 넘김(읽는 틈 배율을 더 낮추세요)`;
    if (타일 > 0) 문제.push(말); else console.warn('⚠ ' + 말 + ' — 배경지도 없는 자리라 알리기만 합니다');
  }
  await 잠깐(1500);                        // 엮기가 2분 57초 자리에서 자를 수 있게 조금 더 받습니다

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
    설명: '「사고 흐름 판 2」 휴대전화 화면 녹화본의 장면 시각(초 · 영상의 0초 기준). make_flow_video_long.mjs 가 씁니다.',
    녹화한날: new Date().toISOString(), 화면, 배경지도타일: 타일, 상황실코드: path.relative(RPATH, 상황실폴더),
    사이트코드: path.relative(RPATH, 사이트폴더),
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
   엮기 — 접속 화면(첫 장면) + 가상 사고 + 녹화본(빠르게). 시계가 2분 57초에서 멈추는 장에서 끝. 자막·사고 카드·타이머·돋보기·음악.
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

  /* 시연 시계의 원점과 끝 — 원점은 첫 화면이 열린 때(접속), 끝은 2분 57초. 녹화가 그보다 늦게 끝났으면 멈춥니다
     (배경지도 없는 개발 자리의 미리 보기만 녹화 끝에 맞춥니다). */
  const 원점 = r('접속');
  let 시연끝 = 원점 + 시연끝초;
  if (r('끝') > 시연끝 + 0.05) {
    const 말 = `녹화가 ${(r('끝') - 원점).toFixed(1)}초 — 2분 57초를 넘깁니다`;
    if (기록.배경지도타일 > 0) throw new Error(말 + ' — 녹화의 읽는 틈 배율을 낮춰 다시 녹화하세요');
    console.warn('⚠ ' + 말 + ' — 배경지도 없는 개발 자리의 녹화라 녹화 끝에 맞춥니다(미리 보기 전용)');
    시연끝 = r('끝') + 0.3;
  }

  /* 영상의 짜임 — 46초 · 120 BPM(한 마디 2초). 장면 경계는 마디 첫 박(음악의 큰 북 자리)입니다.
       0~0.8  첫 장면 = 접속 화면(QR · 첫 화면 · 시계 0:00.0 · 왼쪽 위 작은 사고 카드). PPT 에 넣으면 재생 전 이
              장면이 보입니다(2026-11-23 사용자 — "인트로 사진이 내가 원하던 건 … 수정1 화면이야. 저 화면에서 QR
              코드만 선명하게 … 다른 부가설명은 필요 없어 … 그대로 저 화면에서 영상이 재생되도록").
       0.8~4  가상 사고 — 작은 카드가 가운데로 커졌다가(나머지는 잠깐 물러남) 다시 왼쪽 위로("수정2 의 장면이
              뒤로 밀려나서 수정1 의 화면 이후에").
       4~6    접속(휴대전화 녹화가 흐르기 시작 · 시계가 감)
       6~16   01 현장 안전거리 확인     16~24 02 주민 대피장소 찾기     24~32 03 주민대피 문자생성기
       32~46  04 방제 물품·장비 찾기 — 마지막 장(1/30초)에서 시계가 2분 57초로 멈추고 **그 장에서 영상이 끝납니다**
              (사용자 — "시간은 멈췄는데 영상이 2~3초 더 진행 … 바로 끊기는 게 좋은 것 같아"). 마무리 장면은 없습니다.
     장면 안의 조각은 [녹화 시작, 녹화 끝, 무게] 로 길이를 나눕니다 — 읽는 대목(구역 판정 · 넘겨받음 · 고른
     대피장소 · 문안 · 협의업체 줄)은 무게를 높여 천천히, 치고 누르는 대목은 빠르게. **실제보다 느리게는 돌리지
     않습니다**(넘치는 몫은 다른 조각에). */
  const 판때 = { 키움: 0.8, 키움길이: 0.6, 제목: 1.4, 줄임: 3.4, 줄임길이: 0.6 };
  const 인트로 = 4;                                   // 휴대전화 녹화가 흐르기 시작하는 때
  const 끝장 = 46 - 1 / FPS;                          // 마지막 장 — 시계가 2분 57초를 띄우는 장
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
  const 장면들 = [
    { 끝: 6, 조각: [[r('접속'), r('안전누름', 0.1), 1]] },
    { 끝: 16, 조각: [[r('안전누름', 0.1), r('안전구역', -0.3), 1],
                     [r('안전구역', -0.3), r('안전구역', 2.6), 3],            // 바람을 고르면 구역이 그려짐
                     [r('안전구역', 2.6), r('안전판정', -0.3), 1],
                     [r('안전판정', -0.3), r('안전표'), 6],                   // 내 위치 판정
                     [r('안전표'), r('대피누름', 0.1), 2]] },                 // 거리 표
    { 끝: 24, 조각: [[r('대피누름', 0.1), r('대피받음', -0.2), 1],
                     [r('대피받음', -0.2), r('대피목록으로'), 4],             // 넘겨받음 안내
                     [r('대피목록으로'), r('대피고름', -0.2), 1],
                     [r('대피고름', -0.2), r('대피지도'), 6],                 // 고른 대피장소 줄
                     [r('대피지도'), r('문자누름', 0.1), 1]] },
    { 끝: 32, 조각: [[r('문자누름', 0.1), r('문자문안', -0.3), 1],
                     [r('문자문안', -0.3), r('문자복사'), 8],                 // 표준문안
                     [r('문자복사'), r('처음으로', 0.1), 5]] },
    { 끝: 끝장, 조각: [[r('처음으로', 0.1), r('방제누름', 0.35), 8],           // 첫 화면 → 04 카드(지나치지 않게)
                     [r('방제누름', 0.35), r('방제목록', -0.3), 1],
                     [r('방제목록', -0.3), r('방제굴림'), 11],                // 협의업체 줄 통째
                     [r('방제굴림'), r('물품'), 2.5],                          // 세부 창 · 동원 목록
                     [r('물품'), 시연끝, 1.2]] },                              // 방제물품(흡착포) — 2분 57초에서 끝
  ];
  const 구간 = [];
  const 장면시작 = [];
  let 누적 = 인트로;
  for (const 장 of 장면들) {
    장면시작.push(누적);
    const 몫 = 나누기(장.조각, 장.끝 - 누적);
    장.조각.forEach(([a, b], i) => {
      if (b <= a) throw new Error(`구간 순서가 이상합니다: ${a} → ${b}`);
      구간.push({ a, b, d: 몫[i], s: 누적, 배: (b - a) / 몫[i] });
      누적 += 몫[i];
    });
  }
  for (const g of 구간) if (g.배 < 0.98) console.warn(`⚠ 녹화가 짧아 실제보다 느리게 돕니다(×${g.배.toFixed(2)}) — 녹화의 기다림을 늘리세요`);
  const 내용끝 = 누적;
  const 길이 = Math.round((내용끝 + 1 / FPS) * FPS) / FPS;   // 마지막 장(시계가 멈춘 장) 바로 뒤에서 끝
  const 장면 = { 안전: 장면시작[1], 대피: 장면시작[2], 문자: 장면시작[3], 방제: 장면시작[4], 끝: 내용끝 };
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
  console.log(`영상 ${길이.toFixed(2)}초 · 시계 ${(시연끝 - 원점).toFixed(1)}초에서 멈춤 · 녹화의 끝 표시 ${(r('끝') - 원점).toFixed(1)}초`);

  const 작업 = path.join(RPATH, '.narr/사고흐름3엮기');
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

  /* 2) 자막 — [영상 초, 자막, 이름표, 덧글, 모양]. 화면에 실제로 나오는 것만 말합니다.
     '한줄' 은 자막을 한 줄로 줄여 그 아래 확대(협의업체 줄 통째)를 크게 둘 자리를 냅니다. */
  const V = (k, 더 = 0) => { const v = 영상시각(r(k, 더)); if (v == null) throw new Error('영상 밖 표시: ' + k); return v; };
  const 이01 = '01 현장 안전거리 확인', 이02 = '02 주민 대피장소 찾기', 이03 = '03 주민대피 문자생성기', 이04 = '04 방제 물품·장비 찾기';
  const 자막 = [
    [-1, '설치·회원가입 없이\nQR 하나로 접속', '', ''],           // 첫 장면부터 다 떠 있음(0초 = PPT 의 재생 전 화면)
    [장면.안전, '내 자리는 안전한가?', 이01, '물질 · 사고지점 · 바람'],
    [V('안전구역', -0.3), '바람을 고르면\n구역이 지도에', 이01, ''],
    [V('안전판정', -0.3), '내 위치가\n구역 안인지 바로', 이01, ''],
    [장면.대피, '어디로 대피시킬까?', 이02, '01에서 정한 사고지점·물질 그대로'],
    [V('대피고름', -0.2), '가까운 대피장소를\n거리순으로', 이02, ''],
    [장면.문자, '무엇을 알릴까?', 이03, '02에서 고른 대피장소·지역 그대로'],
    [V('문자문안', -0.3), '승인받은 표준문안\n자동 생성', 이03, ''],
    [V('문자복사', -0.1), '복사해 그대로\n발송 시스템으로', 이03, ''],
    [장면.방제, '무엇으로 막을까?', 이04, '업체 섭외 → 수집·운반'],
    [V('방제목록', -0.3), '미리 협의된 업체가 맨 위에', 이04, '', '한줄'],
    [V('방제세부', -0.5), '연락처·허가 현황을\n한 창에', 이04, ''],
    [V('물품'), '필요한 물품도\n가까운 순으로', 이04, '방제물품 찾기 → 흡착포'],
  ];
  for (let i = 1; i < 자막.length; i++) if (자막[i][0] <= 자막[i - 1][0] + 0.9) console.warn('⚠ 자막이 너무 빨리 바뀝니다: ' + 자막[i][1].replace('\n', ' '));
  /* 돋보기 — [표시, 녹화에서 몇 초 뒤부터, 영상에서 길게는 몇 초, 이 표시 전에 끝냄, 크게].
     다음 누름 전에 끝냅니다(누르면 그 자리가 바뀜). 굴러가는 화면도 비치지 않게 그 전에 끝냅니다. */
  const 다음누름 = (rt) => { const m = 기록.누름.find((x) => x.t > rt + 0.02); return m ? m.t : Infinity; };
  const 돋목록 = [['안전판정', -0.2, 3.8], ['대피받음', 0.0, 2.8], ['대피고름', 0.05, 3.4, '대피지도'],
    ['문자문안', 0.05, 3.4], ['방제목록', 0.1, 6, '방제굴림', true]];
  const 돋보기 = 돋목록.map(([k, 덧, 최대, 끝표시, 크게]) => {
    const 시작 = 영상시각(r(k, 덧));
    const z = 때(k).자리;
    if (시작 == null || !z) { console.warn('돋보기 빠짐: ' + k); return null; }
    let 끝 = 영상시각(다음누름(r(k, 덧)));
    if (끝 == null || !isFinite(끝)) 끝 = Infinity;
    if (끝표시) 끝 = Math.min(끝, 영상시각(r(끝표시)) ?? Infinity);
    return { s: 시작, d: Math.max(0.6, Math.min(최대, isFinite(끝) ? 끝 - 0.05 - 시작 : 최대)), z: { ...z, 크게: !!크게 } };
  }).filter(Boolean);
  console.log('돋보기', 돋보기.map((z) => `${z.s.toFixed(1)}초부터 ${z.d.toFixed(1)}초`).join(' · '));
  const 처음때 = 영상시각(r('처음으로'));
  const 누름자국 = 기록.누름.map((m) => ({ t: 영상시각(m.t), x: m.x, y: m.y })).filter((m) => m.t != null);

  /* 3) 음악 — 장면 경계에 부드러운 북 · 자막이 바뀌는 자리에 작은 북. 재생 전 화면이 머무는 0.8초는 조용히.
     끝은 시계가 멈추는 장에서 바로 끊습니다(마지막 큰 북·울림 없음 · `바로끝`). 화음은 01 부터 8초마다 바뀌어
     46초가 마침 한 바퀴 끝입니다(`화음원점`). */
  const 음악 = path.join(작업, '음악.wav');
  const 큰북 = [장면.안전, 장면.대피, 장면.문자, 장면.방제];
  if (!미리) execFileSync(process.env.PYTHON || 'python3', [path.join(RPATH, 'build/make_flow_music_long.py'), 음악,
    JSON.stringify({ 길이, 시작: 판때.키움, 사고: 판때.제목, 줄임: 판때.줄임, QR: 판때.줄임 + 0.3, 접속: 인트로,
      화음원점: 장면.안전, 큰북, 작은북: 자막.slice(1).map((x) => x[0]).filter((t) => !큰북.includes(t)),
      끝북: 길이, 바로끝: true })], { stdio: 'inherit' });

  const 쉬움 = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const 상태 = (t) => {
    let 자 = null;
    for (const s of 자막) if (t >= s[0]) 자 = s;
    const rt = 원시각(t);
    const 끝남 = t >= 내용끝 - 1e-6;                  // 마지막 장 — 시계를 2분 57초 그대로 띄움
    const 경과 = 끝남 ? 시연끝 - 원점 : rt == null ? 0 : Math.max(0, rt - 원점);
    let 돋 = null;
    for (const z of 돋보기) {
      if (t >= z.s && t < z.s + z.d) 돋 = { ...z.z, a: Math.min(쉬움((t - z.s) / 0.3), 쉬움((z.s + z.d - t) / 0.3)) };
    }
    // 첫 장면부터 휴대전화에 첫 화면이 떠 있습니다(녹화의 첫 장) — 재생 전 화면이 곧 접속 화면
    const 폰i = Math.min(폰장수, Math.max(1, Math.floor((Math.min(t, 내용끝 - 0.001) - 인트로) * FPS) + 1));
    return {
      t, 인트로, qr끝: 장면.안전, 자막: 자 ? 자[1] : '', 이름표: 자 ? 자[2] : '', 덧글: 자 ? 자[3] : '', 한줄: !!(자 && 자[4] === '한줄'),
      자막보임: 자 ? 쉬움((t - 자[0]) / 0.35) : 0,
      폰: 'file://' + path.join(작업, '폰', String(폰i).padStart(5, '0') + '.jpg'),
      경과, 배: 끝남 || rt == null ? 1 : 배속(t), 돋,
      누름: 누름자국.filter((m) => t >= m.t && t < m.t + 0.45).map((m) => ({ x: m.x, y: m.y, a: (t - m.t) / 0.45 })),
      처음으로: 처음때 != null && t >= 처음때 - 0.1 && t < 처음때 + 0.9,
    };
  };

  /* 4) 무대 */
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(RPATH, 'build/영상_사고흐름무대.html'));
  await page.evaluate((o) => window.준비(o), {
    qr: 'file://' + path.join(RPATH, 'docs/QR/QR_접속.svg'), 폭: 기록.화면.width, 높이: 기록.화면.height,
    사고: 기록.가상사고 || 가상사고, 때: 판때,
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
    // 첫 장면의 QR 을 휴대전화로 읽을 수 있게 장면 사진을 높은 화질로(2026-11-23 사용자 — "QR 코드만 선명하게")
    await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 97 });
    if (k === 0) await page.screenshot({ path: 첫장 });          // 첫 장면 — PPT 의 재생 전 화면과 같은 그림
    if (k % 600 === 0) console.log(`찍는 중 ${k}/${장수}`);
  }
  await browser.close();

  /* 5) 사진 + 음악 → mp4. 울림은 넓게 퍼지는 네 겹(60~270ms) — 짧은 되울림(45·95ms)은 북소리 뒤에 '딱' 을
     한 번 더 붙여 총소리처럼 들리게 했습니다(2026-11-22 사용자). */
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS),
    '-i', path.join(작업, '장면', 'f%05d.jpg'), '-i', 음악,
    '-filter_complex', '[1:a]aecho=0.8:0.7:60|120|190|270:0.12|0.09|0.06|0.04,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', process.env.FFPRESET || 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 낼]);
  console.log(`만듦 ${낼} — ${길이.toFixed(2)}초 · 시계는 ${(시연끝 - 원점).toFixed(1)}초에서 멈추고 그 장에서 끝 · 첫 장면 ${첫장}`);
}
