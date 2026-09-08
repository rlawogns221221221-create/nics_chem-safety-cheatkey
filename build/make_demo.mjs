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
   ② **자막** — 화면 아래에 지금 무엇을 하는지 한 줄로 적습니다. 소리가
      없는 영상이라 자막이 해설을 대신합니다.
   ③ **천천히** — 사람이 읽을 수 있는 속도로 움직이고 멈춥니다.

   ── 배경지도에 대하여 ─────────────────────────────────────────
   **자막을 손으로 박지 않습니다.** 화면에 실제로 그려진 타일
   (`<image data-t>`)을 세어, 있으면 있는 대로 없으면 없는 대로 말합니다.
   손으로 박아 두면 환경이 바뀐 날 그 자막이 그대로 거짓말이 됩니다.

   · 개발 자리(이 저장소가 도는 곳)는 게이트웨이가 타일 서버를 막습니다
     (`api.vworld.kr`·`tile.openstreetmap.org` 모두 CONNECT 403).
     그래서 여기서 녹화하면 **경계선만** 나오고 그 사실을 자막으로 밝힙니다.
   · **깃허브 액션 러너는 인터넷이 됩니다.** 그래서 배경지도까지 나오는
     영상은 `.github/workflows/시연영상_녹화.yml` 로 굽습니다
     (임시주거시설을 그렇게 받아 본 것과 같은 길).
   없는 것을 있는 것처럼 그려 넣지는 않습니다.
   ─────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync,
         renameSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const 작업방 = `${RPATH}/.demo-tmp`;
rmSync(작업방, { recursive: true, force: true });
mkdirSync(작업방, { recursive: true });

const 크기 = { width: 1280, height: 800 };

/* 마우스 자리 표시 + 자막 + 제목 카드 — 모든 페이지에 미리 심습니다 */
const 덧그리기 = `
(() => {
  if (window.__demo) return; window.__demo = 1;
  /* 배경지도 경고 띠는 **녹화 자리에서만** 뜨는 것입니다(개발 자리는 타일이
     아예 막히고, 액션 러너는 브이월드가 502 라 OpenStreetMap 으로 넘어갑니다).
     실제 배포 주소에서는 뜨지 않으므로 영상에서 가립니다 — 자바스크립트로
     그때그때 감추면 지도가 다시 그려질 때마다 **깜빡입니다.** */
  const 띠숨김 = document.createElement('style');
  띠숨김.textContent = '#mWarn{display:none!important}';
  (document.head || document.documentElement).appendChild(띠숨김);
  const add = () => {
    if (!document.body) return setTimeout(add, 20);
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
    /* ⚠ 자막을 화면 **아래**에 두면 ③ 의 '다음' 줄과 지도 아래 띠를 덮어
       무엇을 누르는지 안 보입니다. 위 가운데에 알약으로 띄웁니다 —
       세 도구 모두 위쪽 가운데가 비어 있습니다. */
    cap.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);'
      + 'z-index:2147483646;max-width:80%;padding:11px 22px;border-radius:999px;'
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
const 자막 = async (t, ms) => { await p.evaluate((s) => window.__say && window.__say(s), t);
  if (ms) await 잠깐(ms); };
const 제목 = async (big, small, ms) => {
  await p.evaluate(([a, b]) => window.__title && window.__title(a, b), [big, small]);
  if (ms) await 잠깐(ms);
};
/* 사람처럼 — 목표까지 곡선 없이 여러 걸음으로 움직인 뒤 잠깐 멈추고 누릅니다 */
const 가서누르기 = async (sel, { 앞 = 500, 뒤 = 900, i = 0 } = {}) => {
  const el = (await p.$$(sel))[i];
  if (!el) { console.error('  ⚠ 못 찾음: ' + sel); return false; }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (!b) { console.error('  ⚠ 자리 없음: ' + sel); return false; }
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 });
  await 잠깐(앞);
  await p.mouse.down(); await 잠깐(90); await p.mouse.up();
  await 잠깐(뒤);
  return true;
};
const 훑기 = async (sel, ms = 700) => {
  const el = await p.$(sel);
  if (!el) return;
  const b = await el.boundingBox();
  if (!b) return;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await 잠깐(ms);
};
/* 사고지점 좌표 — **타이핑하지 않습니다.** `type` 으로 넣었더니 소수점이
   사라져(128.1135 → 1281135) 엉뚱한 자리가 찍혔습니다. 칸을 눌러 보여 준 뒤
   값을 한 번에 넣습니다. */
const 좌표넣기 = async (lat = '36.1195', lon = '128.1135') => {
  await 가서누르기('#acLat', { 앞: 350, 뒤: 250 });
  await p.fill('#acLat', lat);
  await 잠깐(400);
  await 가서누르기('#acLon', { 앞: 300, 뒤: 250 });
  await p.fill('#acLon', lon);
  await p.dispatchEvent('#acLon', 'input');
  await 잠깐(500);
  await p.keyboard.press('Enter');
};

/* 배경지도 경고 띠는 타일을 못 받는 자리에서만 뜨는 것이라 가리고, 대신
   자막으로 밝힙니다(띠는 여섯 줄까지 늘어나 지도를 밀어냅니다) */
const 띠가리기 = () => p.evaluate(() => {
  const w = document.querySelector('#mWarn'); if (w) w.hidden = true;
  document.querySelectorAll('.alert.w').forEach((e) => { e.style.display = 'none'; });
});

/* 배경지도 타일이 실제로 그려졌는지 센다.
   mapcore 는 받아진 타일만 `<image data-t="z/x/y">` 로 얹으므로, 그 수가
   곧 "화면에 배경지도가 있는가" 입니다. 한 장이라도 오면 나머지가 채워질
   틈을 좀 더 주고 돌아옵니다 — 반쯤 그려진 지도를 찍으면 실제보다
   허술해 보입니다. */
let 배경지도 = null;                       // null=아직 모름 · true/false
const 타일기다리기 = async (최대 = 15000) => {
  const 끝 = Date.now() + 최대;
  let n = 0;
  for (;;) {
    const 봄 = await p.evaluate(() => ({
      n: document.querySelectorAll('svg image[data-t]').length,
      /* 원본이 **모두** 죽으면 화면이 스스로 그렇게 적습니다(mapcore 의
         tileStatus). 그 자리에서는 더 기다려도 오지 않으므로 끊습니다 —
         안 그러면 녹화에 15초짜리 정지 화면이 들어갑니다. */
      끝장: /행정경계선만/.test((document.querySelector('#mWarn') || {}).innerHTML || ''),
    }));
    n = 봄.n;
    if (n > 0) { await 잠깐(2200); break; }
    if (봄.끝장 || Date.now() > 끝) break;
    await 잠깐(400);
  }
  if (배경지도 === null) {
    배경지도 = n > 0;
    console.log(배경지도
      ? `  배경지도 타일 ${n}장 — 도로·건물이 함께 나옵니다`
      : '  배경지도 타일을 못 받았습니다 — 경계선만 나옵니다(자막으로 밝힙니다)');
  }
  return n;
};

/* ══ 0. 표지 ═══════════════════════════════════════════════ */
await p.goto(`${ROOT}index.html`);
await 잠깐(1600);
await 제목('화학사고 초동대응 지원 서비스',
  '사고지점만 넣으면 대피장소 · 재난문자 · 방제자원이<br>가까운 순으로 나옵니다', 3600);
await 제목(null, null, 300);
await 자막('설치도 회원가입도 없습니다 — 주소만 열면 바로 씁니다', 2600);
await 훑기('.pn', 600);
await 자막('업무도구 세 가지를 카드로 고릅니다', 2400);
await 훑기('.pn:nth-of-type(2)', 500);
await 훑기('.pn:nth-of-type(3)', 900);

/* ══ 1. ③ 방제 물품·장비 찾기 ══════════════════════════════ */
await 자막('① 방제 물품·장비 찾기 — 무엇이 어디에 있는지 찾습니다', 2200);
await 가서누르기('.pn', { i: 0, 뒤: 1500 });
await 잠깐(600);

await 자막('맨 처음 두 갈래를 묻습니다 — 맡길 곳(업체)인가, 물건(물품)인가', 3200);
await 훑기('.rz-br', 700);
await 자막('흡착포처럼 「물건」을 찾을 때는 방제물품 찾기', 2400);
await 가서누르기('.rz-br', { i: 1, 뒤: 1400 });

await 자막('필요한 물품을 고릅니다 — 표준 이름 27가지', 2600);
await 훑기('.rz-item', 500);
await 가서누르기('.rz-item', { i: 5, 뒤: 1100 });
await 자막('고른 것을 가진 곳만 나옵니다', 1800);
await 가서누르기('#rzNext', { 뒤: 1300 });

await 자막('사고지점을 넣습니다 — 주소 검색 · 지도에서 찍기 · 내 위치 · 좌표', 3000);
await 가서누르기('#startSkip', { 뒤: 1200 });
await 띠가리기();
await 좌표넣기();
await 잠깐(1800);
await 타일기다리기();
await 띠가리기();
await 자막('사고지점에서 가까운 순으로 나옵니다 — 거리 · 시간 · 보유 물품 · 수량', 3200);
await 훑기('.ms-it', 700);
/* 관내에 없는 것이 드물지 않습니다 — 범위를 넓히는 것도 실제 기능입니다 */
await 자막('관내에 없으면 범위를 넓힙니다 — 5 · 10 · 20 · 50 · 100km', 2400);
await p.selectOption('#mScope', '50000');
await 잠깐(1900);
await 훑기('#shList .ms-it', 1200);

await 자막('줄을 누르면 정작 필요한 것이 창으로 열립니다', 2200);
await 가서누르기('#shList .ms-it', { i: 0, 뒤: 1600 });
await 자막('전화번호가 가장 큰 글자 — 그 아래에 보유 물품과 수량', 3400);
await 훑기('.rkd-tel', 900);
await 훑기('.rkd-items', 1400);
await 자막('여러 곳을 동원 목록에 담아 한 번에 복사할 수 있습니다', 2600);
await 가서누르기('.rkd [data-rkmob]', { 뒤: 1500 });
/* 자막은 **지금 화면에 있는 대로** 말합니다(위 타일기다리기 참고) */
await 자막(배경지도
  ? '지도에는 배경지도(도로·건물) 위에 사고지점과 보유처가 겹쳐 나옵니다'
  : '※ 녹화 환경에서는 배경지도 타일을 받지 못해 경계선만 보입니다 — 실제 화면에는 도로·건물이 함께 나옵니다',
  3600);
await 가서누르기('.rkd-close', { 뒤: 900 });

/* ══ 2. ② 주민 대피장소 찾기 ═══════════════════════════════ */
await 제목('주민 대피장소 찾기', '대피 후보지 17,754곳을 가까운 순으로', 2800);
await 제목(null, null, 200);
await p.goto(`${ROOT}map/index.html`);
await 잠깐(1500);
await 띠가리기();
await 자막('② 주민 대피장소 찾기 — 같은 방식으로 사고지점만 넣습니다', 2600);
await 좌표넣기();
await 잠깐(2000);
await 타일기다리기();
await 띠가리기();
await 자막('가장 가까운 곳과 반경 1 · 2 · 5km 안의 개수가 한 줄로 나옵니다', 3200);
await 훑기('.msum', 900);
await 자막('각 줄에 직선거리 · 도보시간 · 수용인원 · 관할부서 전화', 3000);
await 훑기('#shList .ms-it', 1000);
await 가서누르기('#shList .ms-it', { i: 0, 뒤: 1800 });
await 자막('화학사고 대피장소와 이재민 임시주거시설 두 층을 켜고 끕니다', 3000);
await 훑기('.ms-lyr', 900);

/* ══ 3. ① 주민대피 문자생성기 ══════════════════════════════ */
await 제목('주민대피 문자생성기', '승인받은 표준문안 그대로 · 글자수까지', 2800);
await 제목(null, null, 200);
await p.goto(`${ROOT}sms/index.html`);
await 잠깐(1500);
await 자막('③ 주민대피 문자생성기 — 발송 구분을 먼저 고릅니다', 2600);
await 훑기('#stages', 700);
await 가서누르기('#stages button[data-s=evac]', { 뒤: 1400 });
await 자막('한 화면에 한 묶음만 묻습니다 — 급할 때 헤매지 않게', 2800);
await 훑기('#stepBar', 800);

/* 값 채우기 — 실제로 타이핑하는 칸을 하나 보여 주고, 나머지는 한 번에 */
const 다음 = await p.$('#stepNav .sn-next');
if (다음) { await 가서누르기('#stepNav .sn-next', { 뒤: 1100 }); }
const 첫칸 = await p.$('.fgrp input[type=text]');
if (첫칸) {
  await 가서누르기('.fgrp input[type=text]', { 뒤: 300 });
  await p.keyboard.type('서천군', { delay: 130 });
  await 잠깐(700);
}
await 자막('아는 값부터 채워도 됩니다 — 진행 표시를 눌러 건너뜁니다', 2600);
await p.evaluate((o) => {
  Object.keys(o).forEach((k) => {
    const el = document.getElementById('if_' + k);
    if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}, { 기관: '서천군', 시각: '14:20', 시군: '서천군', 읍면동: '장항읍',
     사업장: '대한케미컬', 대상지역: '장항읍 일원', 물질: '염산',
     대피소: '장항중학교', 집결지: '장항읍 행정복지센터' });
await 잠깐(700);
/* ⚠ 값을 한 번에 넣으면 **사고물질 자동완성 목록**이 열려 화면 왼쪽 위를
   덮습니다(실제로 그렇게 찍혔습니다). 닫고 넘어갑니다. */
await p.keyboard.press('Escape');
await p.evaluate(() => {
  const m = document.querySelector('.mpk');
  if (m) { m.hidden = true; m.style.display = 'none'; }
});
await 잠깐(500);
const 확인 = await p.$('#stepBar button[data-go=out]');
if (확인) { await 가서누르기('#stepBar button[data-go=out]', { 뒤: 1800 }); }
await p.evaluate(() => {
  document.querySelectorAll('.alert.w').forEach((e) => { e.style.display = 'none'; });
});
await 자막('필수 칸이 다 채워지면 표준문안이 만들어집니다 — 글자수까지 함께', 3600);
await 훑기('.out .msg', 2600);
await 훑기('.out .cnt', 1600);
await 자막('복사를 눌러 재난문자 발송시스템에 그대로 붙입니다', 2600);
await 가서누르기('.out footer button', { 뒤: 1600 });

/* ══ 4. 마무리 ═════════════════════════════════════════════ */
await 자막('', 200);
await 제목('chem-safety-kr.pages.dev',
  '설치 · 회원가입 없음 · PC와 휴대전화 · 망분리 PC 는 파일 하나로<br><br>'
  + '개선 의견 · 오류 — 기후에너지환경부 화학물질안전원 김재훈 전문위원<br>'
  + 'kjh221@korea.kr · 온메일 rlawogns@mail.go.kr', 5200);

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
} catch (e) {
  console.error('⚠ mp4 로 바꾸지 못했습니다(ffmpeg 없음?) — webm 만 만들었습니다.');
}
rmSync(작업방, { recursive: true, force: true });
console.log(배경지도
  ? '→ 시연 영상을 만들었습니다 — **배경지도까지 나옵니다.**'
  : '→ 시연 영상을 만들었습니다 — 배경지도 없이 경계선만(자막으로 밝혔습니다).');
