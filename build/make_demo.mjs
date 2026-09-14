/* 시연 영상 만들기 — 실제 화면을 눌러 가며 녹화합니다
   ───────────────────────────────────────────────────────────────
       node build/make_demo.mjs

   결과물 : docs/AI프렌즈_시연영상.mp4  (없으면 .webm 만)

   ── 왜 이렇게 만드나 ───────────────────────────────────────────
   심사에 낼 영상이라 **실제로 도는 화면**이어야 합니다. 화면을 따로 그리지
   않고 크로미움에 우리 화면을 띄워 사람이 하듯 눌러 가며 녹화합니다
   (playwright 의 recordVideo). 그래서 영상에 나오는 숫자·목록은 전부
   실제 자료에서 나온 값입니다.

   ── 세 가지 장치 ──────────────────────────────────────────────
   ① **마우스 자리 표시** — 녹화에는 커서가 찍히지 않습니다. 그대로 두면
      "저절로 눌리는" 영상이 되어 무엇을 누르는지 알 수 없습니다.
      그래서 마우스를 따라다니는 동그라미를 페이지에 그려 넣습니다.
   ② **자막** — 화면 **아래쪽**에 지금 무엇을 하는지 한 줄로 적습니다
      (2026-09-14 사용자 요청). 아래에는 ③ 의 '다음' 줄처럼 늘 붙어 있는
      띠가 있어서, 그 높이를 **재서 그만큼 띄웁니다**(`자막자리`).
   ③ **천천히** — 사람이 읽을 수 있는 속도로 움직이고 멈춥니다.

   ── 사고지점은 사업장 이름으로 넣습니다 (2026-09-14 사용자 요청) ──
   예전에는 위도·경도를 쳐 넣었습니다. 사용자가 "대표 사업장으로
   SK하이닉스 청주공장" 을 넣어 달라고 해서 이름으로 찾습니다.
   · ③ 은 **우리 자료에 그 사업장이 실제로 있습니다** —
     `SK하이닉스㈜ · 청주시 흥덕구 대신로 215`(방제자원 보유처). 이름을 치면
     인터넷 없이도 찾힙니다.
   · 고른 뒤 지도가 청주로 옮겨 가고 **"지도를 누르세요"** 가 뜹니다. 그 줄의
     좌표가 시·군·구 단위 어림값이라 도구가 **사고지점으로 자동 확정하지
     않는 것**입니다(어림값을 잰 값처럼 쓰지 않는다는 원칙). 그래서 마지막
     한 번은 지도를 눌러 확정합니다 — 영상은 그 흐름 그대로 보여 줍니다.
   · ② 의 검색 색인에는 대피장소·시·군·구·읍·면·동만 있어 그 이름이 없습니다.
     그래서 ② 에서는 **"청주"** 로 찾아 시·군·구를 고르고 지도를 눌러
     확정합니다. 어느 쪽도 좌표를 치지 않습니다.
   · ⚠ 브이월드 장소 검색(사업장 이름을 아무거나 찾는 기능)은 **녹화 자리에서
     쓸 수 없습니다** — 러너 IP 를 브이월드가 거절합니다(타일 502 · 검색 무응답,
     배포 주소를 Referer 로 붙여도 같음). 그래서 **우리 자료로 찾히는 이름**을
     골라 녹화합니다. 실제 국내망에서는 아무 사업장 이름이나 찾힙니다.

   ── ① 문안은 가상 상황입니다 ──────────────────────────────────
   실제 회사 이름이 재난문자 예시에 들어가므로, 그 장면에서 **가상 상황임을
   자막으로 분명히 밝힙니다.** 지우지 마세요 — 영상만 따로 퍼졌을 때 실제
   사고로 오해될 수 있습니다.

   ── 배경지도에 대하여 ─────────────────────────────────────────
   **자막을 손으로 박지 않습니다.** 화면에 실제로 그려진 타일
   (`<image data-t>`)을 세어, 있으면 있는 대로 없으면 없는 대로 말합니다.
   손으로 박아 두면 환경이 바뀐 날 그 자막이 그대로 거짓말이 됩니다.
   · 개발 자리는 게이트웨이가 타일 서버를 막아 **경계선만** 나옵니다.
   · **깃허브 액션 러너는 인터넷이 됩니다** —
     `.github/workflows/시연영상_녹화.yml` 로 굽습니다.

   ── 정적인 화면을 만들지 않습니다 (2026-09-14 사용자 요청) ────
   예전 판은 **45%(78초)가 완전 정지 화면**이었습니다(ffmpeg freezedetect 로
   잼). 자막만 떠 있고 아무것도 안 움직이는 구간이 4.8초까지 있었습니다.
   · 기다릴 때는 `머무르기()` 로 **커서를 아주 조금씩 움직입니다** — 사람이
     화면을 보는 것처럼 보이고, 프레임이 완전히 같아지지 않습니다.
   · 자막을 띄우는 시간을 2초 안팎으로 줄였습니다.
   · 굽고 나서 **직접 다시 재어** 긴 정지 구간이 남았으면 알려 줍니다
     (`정적검사`).
   ─────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync,
         renameSync, rmSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const 작업방 = `${RPATH}/.demo-tmp`;
rmSync(작업방, { recursive: true, force: true });
mkdirSync(작업방, { recursive: true });

const 크기 = { width: 1280, height: 800 };

/* 이 영상에서 쓰는 사고지점 — 우리 자료에 실제로 있는 사업장입니다
   (data/resources2.js : SK하이닉스㈜ · 충청북도 청주시 흥덕구 대신로 215) */
const 사업장 = 'SK하이닉스';
const 지역 = '청주';

/* 마우스 자리 표시 + 자막 + 제목 카드 — 모든 페이지에 미리 심습니다 */
const 덧그리기 = `
(() => {
  if (window.__demo) return; window.__demo = 1;
  const add = () => {
    if (!document.body) return setTimeout(add, 20);
    /* ⚠ 이 아래 일은 **문서가 만들어진 뒤에** 해야 합니다. 예전에 이 IIFE 의
       첫 줄에서 스타일을 붙였는데, 문서가 아직 없는 순간에 실행되면 거기서
       예외가 나고 **커서도 자막도 통째로 안 그려졌습니다**(그렇게 녹화된
       판이 실제로 나왔습니다 — 움직이는 것이 하나도 없는 영상).
       배경지도 경고 띠는 녹화 자리에서만 뜨는 것이라 여기서 가립니다. */
    try {
      const 띠숨김 = document.createElement('style');
      띠숨김.textContent = '#mWarn{display:none!important}';
      document.head.appendChild(띠숨김);
    } catch (e) {}
    const dot = document.createElement('div');
    dot.id = '__cur';
    /* 붉은 고리는 '금지' 표지처럼 읽혀서 남색으로 둡니다 */
    dot.style.cssText = 'position:fixed;left:-100px;top:-100px;width:26px;'
      + 'height:26px;border-radius:50%;border:3px solid #0b50d0;'
      + 'background:rgba(37,110,244,.20);box-shadow:0 0 0 2px #fff,0 2px 8px rgba(0,0,0,.35);'
      + 'z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);'
      + 'transition:width .12s,height .12s';
    document.body.appendChild(dot);
    const cap = document.createElement('div');
    cap.id = '__cap';
    /* 자막은 **아래 가운데**입니다(사용자 요청). 아래에 붙어 있는 띠
       (③ 의 '다음' 줄 등)를 덮지 않도록 바닥에서 띄우는 값은 밖에서
       재어 넣습니다 — window.__capAt(px). */
    cap.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);'
      + 'z-index:2147483646;max-width:82%;padding:11px 22px;border-radius:999px;'
      + 'background:rgba(10,20,32,.93);color:#fff;text-align:center;'
      + 'font:700 20px/1.35 "Pretendard GOV",system-ui,sans-serif;'
      + 'letter-spacing:-.01em;word-break:keep-all;pointer-events:none;'
      + 'box-shadow:0 6px 20px rgba(0,0,0,.3);opacity:0;transition:opacity .25s';
    document.body.appendChild(cap);
    const card = document.createElement('div');
    card.id = '__card';
    card.style.cssText = 'position:fixed;inset:0;z-index:2147483645;'
      + 'background:linear-gradient(160deg,#0b50d0,#06266a);color:#fff;display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;gap:14px;'
      + 'font-family:"Pretendard GOV",system-ui,sans-serif;text-align:center;'
      + 'opacity:0;transition:opacity .4s;pointer-events:none';
    document.body.appendChild(card);
    addEventListener('mousemove', (e) => {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
    }, true);
    addEventListener('mousedown', () => {
      dot.style.width = '40px'; dot.style.height = '40px';
    }, true);
    addEventListener('mouseup', () => {
      dot.style.width = '26px'; dot.style.height = '26px';
    }, true);
  };
  add();
  window.__say = (t) => {
    const c = document.getElementById('__cap');
    if (!c) return;
    c.textContent = t || '';
    c.style.opacity = t ? '1' : '0';
  };
  window.__capAt = (px) => {
    const c = document.getElementById('__cap');
    if (c) c.style.bottom = px + 'px';
  };
  /* 아래에 늘 붙어 있는 띠의 높이를 잽니다 — 자막이 그것을 덮지 않게 */
  window.__bottomBar = () => {
    let h = 0;
    document.querySelectorAll('body *').forEach((el) => {
      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'sticky') return;
      if (st.visibility === 'hidden' || st.display === 'none') return;
      const r = el.getBoundingClientRect();
      if (!r.height || r.height > 200) return;
      if (Math.abs(r.bottom - innerHeight) < 4) h = Math.max(h, r.height);
    });
    return h;
  };
  window.__title = (big, small) => {
    const c = document.getElementById('__card');
    if (!c) return;
    c.innerHTML = big === null ? '' :
      '<div style="font-size:15px;letter-spacing:.14em;opacity:.85">'
      + '2026 AI프렌즈 프로젝트 · 화학안전치트키</div>'
      + '<div style="font-size:44px;font-weight:700;line-height:1.15">' + big + '</div>'
      + (small ? '<div style="font-size:20px;opacity:.9;line-height:1.5">'
        + small + '</div>' : '');
    c.style.opacity = big === null ? '0' : '1';
  };
})();`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: 크기, deviceScaleFactor: 1,
  recordVideo: { dir: 작업방, size: 크기 },
});
await ctx.addInitScript(덧그리기);
const p = await ctx.newPage();

/* ── 손놀림 ────────────────────────────────────────────────── */
const 잠깐 = (ms) => p.waitForTimeout(ms);
let 커서 = { x: 640, y: 400 };                 // 지금 마우스가 있는 자리

/* 기다리는 동안 커서를 아주 조금씩 움직입니다 — 완전히 멈춘 화면을
   만들지 않기 위해서입니다(정적 구간이 45%였습니다). */
const 머무르기 = async (ms) => {
  /* ⚠ 아주 조금(5~7px)만 흔들었더니 **눈에도 검출기에도 안 잡혔습니다** —
     정지 구간이 오히려 늘었습니다. 글을 눈으로 따라가듯 **40px 안팎으로
     느리게 훑어야** 화면이 살아 있어 보입니다. */
  /* ⚠ 마우스를 옮기는 것 자체가 시간을 먹습니다. 그것을 빼지 않고 `ms` 만큼
     더 기다렸더니 영상이 175초 → 193초로 **길어졌습니다.** 끝날 시각을 먼저
     정해 놓고 그 안에서만 움직입니다. */
  const 끝 = Date.now() + ms, 반경 = 42;
  let t = 0;
  while (Date.now() < 끝) {
    const 각 = t / 520;
    await p.mouse.move(커서.x + Math.sin(각) * 반경,
                       커서.y + Math.sin(각 * 0.6) * (반경 * 0.35), { steps: 3 });
    const 남 = 끝 - Date.now();
    if (남 <= 0) break;
    await 잠깐(Math.min(130, 남));
    t += 190;
  }
};

const 자막 = async (t, ms) => {
  await p.evaluate((s) => window.__say && window.__say(s), t);
  if (ms) await 머무르기(ms);
};
const 제목 = async (big, small, ms) => {
  await p.evaluate(([a, b]) => window.__title && window.__title(a, b), [big, small]);
  if (ms) await 잠깐(ms);                      // 카드는 글자가 커서 커서를 안 움직입니다
};
/* 아래 띠 높이를 재어 자막을 그만큼 띄웁니다(화면마다 다릅니다).
   ⚠ **덧그리기가 실제로 붙었는지 여기서 확인합니다.** 한 번 조용히 죽어서
   커서도 자막도 없는 영상이 그대로 구워진 적이 있습니다 — 그런 판을 사용자에게
   보내지 않도록, 없으면 그 자리에서 멈춥니다. */
const 자막자리 = async () => {
  await p.waitForFunction(() => !!document.getElementById('__cap')
    && !!document.getElementById('__cur'), null, { timeout: 5000 })
    .catch(() => { throw new Error('덧그리기(커서·자막)가 화면에 붙지 않았습니다'); });
  const h = await p.evaluate(() => (window.__bottomBar ? window.__bottomBar() : 0));
  await p.evaluate((px) => window.__capAt && window.__capAt(px), Math.round(h) + 20);
};

/* 사람처럼 — 목표까지 여러 걸음으로 움직인 뒤 잠깐 멈추고 누릅니다 */
const 가서누르기 = async (sel, { 앞 = 420, 뒤 = 800, i = 0 } = {}) => {
  const el = (await p.$$(sel))[i];
  if (!el) { console.error('  ⚠ 못 찾음: ' + sel); return false; }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (!b) { console.error('  ⚠ 자리 없음: ' + sel); return false; }
  커서 = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await p.mouse.move(커서.x, 커서.y, { steps: 22 });
  await 잠깐(앞);
  await p.mouse.down(); await 잠깐(90); await p.mouse.up();
  await 머무르기(뒤);
  return true;
};
const 훑기 = async (sel, ms = 600) => {
  const el = await p.$(sel);
  if (!el) return;
  const b = await el.boundingBox();
  if (!b) return;
  커서 = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await p.mouse.move(커서.x, 커서.y, { steps: 18 });
  await 머무르기(ms);
};
/* 목록을 훑어 내려가며 읽는 느낌 — 멈춰 있지 않게 */
const 훑어내리기 = async (sel, ms = 1400) => {
  const el = await p.$(sel);
  if (!el) return;
  const b = await el.boundingBox();
  if (!b) return;
  const 걸음 = 6, 간격 = Math.max(120, Math.round(ms / 걸음));
  for (let k = 0; k <= 걸음; k++) {
    커서 = { x: b.x + b.width * 0.45, y: b.y + 16 + (b.height - 32) * (k / 걸음) };
    await p.mouse.move(커서.x, 커서.y, { steps: 6 });
    await 잠깐(간격);
  }
};

/* 배경지도 경고 띠는 CSS 로 이미 가렸고, 여기서는 예시값 주의 띠만 다룹니다 */
const 예시띠가리기 = () => p.evaluate(() => {
  document.querySelectorAll('.alert.w').forEach((e) => { e.style.display = 'none'; });
});

/* 배경지도 타일이 실제로 그려졌는지 센다. (윗글 참고) */
let 배경지도 = null;                       // null=아직 모름 · true/false
const 타일기다리기 = async (최대 = 15000) => {
  const 끝 = Date.now() + 최대;
  let n = 0;
  for (;;) {
    const 봄 = await p.evaluate(() => ({
      n: document.querySelectorAll('svg image[data-t]').length,
      끝장: /행정경계선만/.test((document.querySelector('#mWarn') || {}).innerHTML || ''),
    }));
    n = 봄.n;
    if (n > 0) { await 머무르기(1600); break; }
    if (봄.끝장 || Date.now() > 끝) break;
    await 잠깐(350);
  }
  if (배경지도 === null) {
    배경지도 = n > 0;
    console.log(배경지도
      ? `  배경지도 타일 ${n}장 — 도로·건물이 함께 나옵니다`
      : '  배경지도 타일을 못 받았습니다 — 경계선만 나옵니다(자막으로 밝힙니다)');
  }
  return n;
};

/* 사고지점을 **이름으로** 넣습니다 — 좌표를 치지 않습니다.
   고른 줄의 좌표가 어림값이면 도구가 "지도를 누르세요" 를 띄우므로,
   그때는 지도를 한 번 눌러 확정합니다(그것이 이 도구의 원칙입니다). */
const 이름으로찍기 = async (검색칸, 이름, 고를것) => {
  await 가서누르기(검색칸, { 앞: 320, 뒤: 200 });
  await p.fill(검색칸, '');
  await p.type(검색칸, 이름, { delay: 95 });
  await 잠깐(900);
  /* ⚠ 인터넷 검색을 한 번 걸었다가 끝나면 **목록이 다시 그려집니다.** 그
     전에 줄을 붙잡아 두면 누를 때 "Element is not attached to the DOM" 으로
     죽습니다(러너에서 실제로 그렇게 죽었습니다). 다 그려진 뒤에 고르고,
     붙잡은 손잡이가 아니라 **그때 다시 찾는 방식(locator)** 으로 누릅니다. */
  await p.waitForFunction(() => !document.querySelector('.mpk-busy'),
    null, { timeout: 9000 }).catch(() => {});
  await 잠깐(500);
  const 줄 = 고를것
    ? p.locator('.mpk-row', { hasText: 고를것 }).first()
    : p.locator('.mpk-row').first();
  const 있 = await 줄.count().catch(() => 0);
  const 쓸줄 = 있 ? 줄 : p.locator('.mpk-row').first();
  if (!(await 쓸줄.count())) {
    console.error('  ⚠ 검색 결과가 없습니다: ' + 이름);
    return false;
  }
  const b = await 쓸줄.boundingBox().catch(() => null);
  if (b) {
    커서 = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await p.mouse.move(커서.x, 커서.y, { steps: 16 });
    await 잠깐(420);
  }
  await 쓸줄.click();
  await 머무르기(1100);
  /* 어림 좌표면 "지도를 누르세요" 가 뜹니다 — 한 번 눌러 사고지점을 확정 */
  const 누르랄때 = await p.$('text=지도를 누르세요');
  if (누르랄때) {
    await 자막('어림잡은 좌표는 사고지점으로 자동 확정하지 않습니다 — 지도에서 한 번 확정', 1900);
    const map = await p.$('.mmap');
    const mb = await map.boundingBox();
    커서 = { x: mb.x + mb.width * 0.5, y: mb.y + mb.height * 0.46 };
    await p.mouse.move(커서.x, 커서.y, { steps: 20 });
    await 잠깐(380);
    await p.mouse.down(); await 잠깐(90); await p.mouse.up();
    await 머무르기(1200);
  }
  return true;
};

/* ══ 0. 표지 ═══════════════════════════════════════════════ */
await p.goto(`${ROOT}index.html`);
await 잠깐(1100);
await 자막자리();
await 제목('화학사고 초동대응 지원 서비스',
  '사고지점만 넣으면 대피장소 · 재난문자 · 방제자원이<br>가까운 순으로 나옵니다', 2200);
await 제목(null, null, 250);
await 자막('설치도 회원가입도 없습니다 — 주소만 열면 바로 씁니다', 1700);
await 훑기('.pn', 500);
await 자막('업무도구 세 가지를 카드로 고릅니다', 1500);
await 훑기('.pn:nth-of-type(2)', 450);
await 훑기('.pn:nth-of-type(3)', 700);

/* ══ 1. ③ 방제 물품·장비 찾기 ══════════════════════════════ */
await 자막('① 방제 물품·장비 찾기 — 무엇이 어디에 있는지 찾습니다', 1600);
await 가서누르기('.pn', { i: 0, 뒤: 1200 });
await 잠깐(500);
await 자막자리();

await 자막('맨 처음 두 갈래를 묻습니다 — 맡길 곳(업체)인가, 물건(물품)인가', 2000);
await 훑기('.rz-br', 500);
await 자막('흡착포처럼 「물건」을 찾을 때는 방제물품 찾기', 1500);
await 가서누르기('.rz-br', { i: 1, 뒤: 1100 });
await 자막자리();

await 자막('필요한 물품을 고릅니다 — 표준 이름 27가지', 1700);
await 훑어내리기('.rz-in', 1300);
await 가서누르기('.rz-item', { i: 5, 뒤: 900 });
await 자막('고른 것을 가진 곳만 나옵니다', 1200);
await 가서누르기('#rzNext', { 뒤: 1000 });
await 자막자리();

/* 사고지점 — 좌표가 아니라 **사업장 이름**으로 */
await 자막('사고지점은 사업장 이름으로 넣습니다 — 예) SK하이닉스 청주', 2100);
await 이름으로찍기('#startQ', 사업장, 'SK하이닉스');
await 타일기다리기();
await 예시띠가리기();
await 자막자리();
await 자막('사고지점에서 가까운 순으로 나옵니다 — 거리 · 시간 · 보유 물품 · 수량', 2100);
await 훑어내리기('#shList', 1500);
/* 관내에 없는 것이 드물지 않습니다 — 범위를 넓히는 것도 실제 기능입니다 */
await 자막('관내에 없으면 범위를 넓힙니다 — 5 · 10 · 20 · 50 · 100km', 1700);
await p.selectOption('#mScope', '50000');
await 머무르기(1500);
await 훑어내리기('#shList', 1600);

await 자막('줄을 누르면 정작 필요한 것이 창으로 열립니다', 1500);
await 가서누르기('#shList .ms-it', { i: 0, 뒤: 1300 });
await 자막('전화번호가 가장 큰 글자 — 그 아래에 보유 물품과 수량', 2200);
await 훑기('.rkd-tel', 700);
await 훑어내리기('.rkd-items', 1500);
await 자막('여러 곳을 동원 목록에 담아 한 번에 복사할 수 있습니다', 1800);
await 가서누르기('.rkd [data-rkmob]', { 뒤: 1200 });
/* 자막은 **지금 화면에 있는 대로** 말합니다(위 타일기다리기 참고) */
await 자막(배경지도
  ? '지도에는 배경지도(도로·건물) 위에 사고지점과 보유처가 겹쳐 나옵니다'
  : '※ 녹화 환경에서는 배경지도 타일을 받지 못해 경계선만 보입니다 — 실제 화면에는 도로·건물이 함께 나옵니다',
  2400);
await 가서누르기('.rkd-close', { 뒤: 700 });

/* ══ 2. ② 주민 대피장소 찾기 ═══════════════════════════════ */
await 제목('주민 대피장소 찾기', '대피 후보지 17,754곳을 가까운 순으로', 1600);
await 제목(null, null, 200);
await p.goto(`${ROOT}map/index.html`);
await 잠깐(1000);
await 자막자리();
await 자막('② 주민 대피장소 찾기 — 같은 방식으로 사고지점만 넣습니다', 1800);
await 이름으로찍기('#mAddrQ', 지역, '시·군·구');
await 타일기다리기();
await 예시띠가리기();
await 자막자리();
await 자막('가장 가까운 곳과 반경 1 · 2 · 5km 안의 개수가 한 줄로 나옵니다', 2200);
await 훑기('.msum', 800);
await 자막('각 줄에 직선거리 · 도보시간 · 수용인원 · 관할부서 전화', 2000);
await 훑어내리기('#shList', 1600);
await 가서누르기('#shList .ms-it', { i: 0, 뒤: 1400 });
await 자막('화학사고 대피장소와 이재민 임시주거시설 두 층을 켜고 끕니다', 2100);
await 훑기('.ms-lyr', 800);

/* ══ 3. ① 주민대피 문자생성기 ══════════════════════════════ */
await 제목('주민대피 문자생성기', '승인받은 표준문안 그대로 · 글자수까지', 1600);
await 제목(null, null, 200);
await p.goto(`${ROOT}sms/index.html`);
await 잠깐(1000);
await 자막자리();
await 자막('③ 주민대피 문자생성기 — 발송 구분을 먼저 고릅니다', 1800);
await 훑기('#stages', 550);
await 가서누르기('#stages button[data-s=evac]', { 뒤: 1100 });
await 자막('한 화면에 한 묶음만 묻습니다 — 급할 때 헤매지 않게', 1900);
await 훑기('#stepBar', 650);
await 자막자리();

/* 값 채우기 — 실제로 타이핑하는 칸을 하나 보여 주고, 나머지는 한 번에 */
const 다음 = await p.$('#stepNav .sn-next');
if (다음) { await 가서누르기('#stepNav .sn-next', { 뒤: 900 }); }
const 첫칸 = await p.$('.fgrp input[type=text]');
if (첫칸) {
  await 가서누르기('.fgrp input[type=text]', { 뒤: 250 });
  await p.keyboard.type('청주시', { delay: 120 });
  await 머무르기(600);
}
await 자막('아는 값부터 채워도 됩니다 — 진행 표시를 눌러 건너뜁니다', 1900);
/* ⚠ 사업장 이름이 실제 회사라 **가상 상황임을 반드시 밝힙니다**(윗글 참고) */
await p.evaluate((o) => {
  Object.keys(o).forEach((k) => {
    const el = document.getElementById('if_' + k);
    if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}, { 기관: '청주시', 시각: '14:20', 시군: '청주시', 읍면동: '흥덕구',
     사업장: 'SK하이닉스㈜ 청주', 대상지역: '흥덕구 일원', 물질: '염산',
     대피소: '청주실내체육관', 집결지: '흥덕구 행정복지센터' });
await 잠깐(600);
/* ⚠ 값을 한 번에 넣으면 **사고물질 자동완성 목록**이 열려 화면 왼쪽 위를
   덮습니다(실제로 그렇게 찍혔습니다). 닫고 넘어갑니다. */
await p.keyboard.press('Escape');
await p.evaluate(() => {
  const m = document.querySelector('.mpk');
  if (m) { m.hidden = true; m.style.display = 'none'; }
});
await 잠깐(400);
const 확인 = await p.$('#stepBar button[data-go=out]');
if (확인) { await 가서누르기('#stepBar button[data-go=out]', { 뒤: 1400 }); }
await 예시띠가리기();
await 자막자리();
await 자막('※ 아래 문안은 기능 설명을 위한 가상 상황입니다 — 실제 사고가 아닙니다', 2600);
await 자막('필수 칸이 다 채워지면 표준문안이 만들어집니다 — 글자수까지 함께', 2200);
await 훑어내리기('.out', 1800);
await 훑기('.out .cnt', 1100);
await 자막('복사를 눌러 재난문자 발송시스템에 그대로 붙입니다', 1800);
await 가서누르기('.out footer button', { 뒤: 1300 });

/* ══ 4. 마무리 ═════════════════════════════════════════════ */
await 자막('', 200);
await 제목('chem-safety-kr.pages.dev',
  '설치 · 회원가입 없음 · PC와 휴대전화 · 망분리 PC 는 파일 하나로<br><br>'
  + '개선 의견 · 오류 — 기후에너지환경부 화학물질안전원 김재훈 전문위원<br>'
  + 'kjh221@korea.kr · 온메일 rlawogns@mail.go.kr', 3000);

await p.close();
await ctx.close();
await browser.close();

/* ── 파일 정리 · mp4 로 바꾸기 ─────────────────────────────── */
const webm = readdirSync(작업방).filter((f) => f.endsWith('.webm'));
if (!webm.length) { console.error('⚠ 녹화 파일이 없습니다.'); process.exit(1); }
const 원본 = `${작업방}/${webm[0]}`;
const 낼webm = `${RPATH}/docs/AI프렌즈_시연영상.webm`;
renameSync(원본, 낼webm);
console.log(`docs/AI프렌즈_시연영상.webm   ${(readFileSync(낼webm).length / 1024 / 1024).toFixed(1)}MB`);

/* mp4 는 한글·파워포인트에 그대로 붙습니다. ffmpeg 이 있으면 함께 만듭니다 —
   `FFMPEG` 환경변수로 정적 빌드 경로를 넘길 수 있습니다. */
const ff = process.env.FFMPEG || 'ffmpeg';
/* 러너는 코어가 둘뿐이라 `slow` 로 굽는 데 십수 분이 걸립니다 —
   `FFPRESET` 로 낮춰 잡을 수 있게 둡니다(crf 가 같으면 화질 차이는 작습니다) */
const 프리셋 = process.env.FFPRESET || 'slow';
const 낼mp4 = `${RPATH}/docs/AI프렌즈_시연영상.mp4`;
try {
  console.log(`mp4 로 굽는 중 (preset ${프리셋}) …`);
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error',
    '-i', 낼webm, '-c:v', 'libx264', '-preset', 프리셋, '-crf', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', 낼mp4],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(`docs/AI프렌즈_시연영상.mp4    ${(readFileSync(낼mp4).length / 1024 / 1024).toFixed(1)}MB`);
  /* mp4 가 나왔으면 webm 은 지웁니다 — 같은 영상을 두 벌 두면 저장소만
     커지고 어느 쪽이 최신인지 헷갈립니다. */
  rmSync(낼webm, { force: true });
  정적검사(낼mp4);
} catch (e) {
  console.error('⚠ mp4 로 바꾸지 못했습니다(ffmpeg 없음?) — webm 만 만들었습니다.');
}
rmSync(작업방, { recursive: true, force: true });
console.log(배경지도
  ? '→ 시연 영상을 만들었습니다 — **배경지도까지 나옵니다.**'
  : '→ 시연 영상을 만들었습니다 — 배경지도 없이 경계선만(자막으로 밝혔습니다).');

/* 굽고 나서 **정지 화면이 얼마나 남았는지 직접 잽니다.**
   "정적이 흐르는 지점" 은 눈으로 찾기 어렵고, 고쳤다고 말하려면 재야 합니다. */
function 정적검사(파일) {
  /* ⚠ freezedetect 는 **표준오류**로 적습니다. ffmpeg 은 성공하면 예외를 던지지
     않으므로 `execFileSync` 의 catch 에서만 읽으면 **아무것도 못 읽습니다**
     (처음에 그렇게 만들어 검사가 조용히 아무 일도 안 했습니다). */
  const r = spawnSync(ff, ['-hide_banner', '-i', 파일,
    '-vf', 'freezedetect=n=-55dB:d=1.6', '-map', '0:v', '-f', 'null', '-'],
    { encoding: 'utf8' });
  const 로그 = String((r.stderr || '') + (r.stdout || ''));
  if (!로그) { console.log('  (정지 구간을 재지 못했습니다)'); return; }
  const 길이 = [...로그.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => +m[1]);
  if (!길이.length) { console.log('  정지 화면 없음'); return; }
  const 합 = 길이.reduce((a, b) => a + b, 0), 최대 = Math.max(...길이);
  console.log(`  정지 구간 ${길이.length}곳 · 합계 ${합.toFixed(1)}초 · 가장 긴 것 ${최대.toFixed(1)}초`);
  if (최대 > 2.6) console.log('  ⚠ 2.6초를 넘는 정지 구간이 있습니다 — 기다리는 시간을 줄이세요.');
}
