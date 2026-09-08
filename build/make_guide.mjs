/* 지자체 담당자용 설명서 만들기 (PDF 두 가지)
   ───────────────────────────────────────────────────────────────
       node build/make_guide.mjs

   ── 무엇을 하나 ────────────────────────────────────────────────
   ① 실제 화면에 **번호 딱지를 박아** 사진을 찍습니다(docs/guide-img/).
   ② `docs/사용설명서.html` 과 `docs/원페이퍼.html` 을 A4 PDF 로 굽습니다.
      원페이퍼는 **한 쪽을 넘기면 멈춥니다.**

   ── 왜 번호 딱지를 화면에 박나 ─────────────────────────────────
   예전 설명서는 글이 5,900자였습니다. "오른쪽 위 ⋮ 를 누른 뒤 저장 및
   공유 → 바로가기 만들기" 같은 문장이 자리를 다 먹었습니다.
   사용자가 **"글은 최대한 줄이고 그림으로"** 를 요청해서, 가리킬 자리를
   사진 안에 ①②③ 으로 박고 설명서에는 낱말만 남깁니다.

   딱지를 **사진 안에** 박는 이유 — 설명서 쪽에서 좌표로 얹으면 화면을
   조금만 고쳐도 딱지가 엉뚱한 곳을 가리킵니다. 여기서 실제 요소의 자리를
   재어 박으면 화면이 바뀌어도 늘 맞습니다.

   ── 배경지도가 없는 사진에 대하여 ──────────────────────────────
   이 개발 환경은 바깥 인터넷으로 못 나가서 **배경지도 타일을 못 받습니다.**
   그래서 지도 사진에는 행정경계선과 표시만 나옵니다. 실제 화면에는 도로·
   건물이 함께 보입니다 — 설명서에도 그렇게 적어 두었습니다. 없는 것을
   있는 것처럼 그려 넣지 않습니다. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const IMG = `${RPATH}/docs/guide-img`;
mkdirSync(IMG, { recursive: true });

const PC = { width: 1280, height: 900 };
const 폰 = { width: 390, height: 780 };

const browser = await chromium.launch();

/* 이 환경은 배경지도 타일을 못 받아 "배경지도를 불러오지 못했습니다" 띠가
   뜹니다. 실제 배포 주소에서는 뜨지 않는 띠이므로 사진에서는 가립니다 —
   없는 고장을 설명서에 실어 놓으면 읽는 사람이 자기 화면이 잘못된 줄 압니다. */
const 띠가리기 = async (page) => {
  await page.evaluate(() => {
    const w = document.querySelector('#mWarn');
    if (w) w.hidden = true;
  });
  await page.waitForTimeout(150);
};

/* ── 번호 딱지 ──────────────────────────────────────────────────
   목록 = [{ n: 1, sel: ".rz-need", i: 0, 자리: "좌상" }, …]
     n    화면에 찍을 번호
     sel  가리킬 요소 (i 로 몇 번째인지 고를 수 있음)
     자리 딱지를 요소의 어느 모서리에 붙일지 — 좌상(기본)·우상·좌하·우하
   요소 둘레에 붉은 테두리를 두르고 그 모서리에 번호를 답니다. */
const 딱지 = async (page, 목록) => {
  await page.evaluate((items) => {
    document.querySelectorAll('.guide-mk,.guide-ring').forEach(e => e.remove());
    items.forEach((it) => {
      const els = document.querySelectorAll(it.sel);
      const el = els[it.i || 0];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const X = window.scrollX, Y = window.scrollY;

      /* 테두리는 요소 **안쪽 선**에 그립니다 — 밖으로 4px 만 나가도
         잘라 찍는 사진(예: 진입 화면의 카드 줄)에서는 잘려 나갑니다. */
      const ring = document.createElement('div');
      ring.className = 'guide-ring';
      Object.assign(ring.style, {
        position: 'absolute', left: (r.left + X) + 'px', top: (r.top + Y) + 'px',
        width: r.width + 'px', height: r.height + 'px',
        border: '3px solid #de3412', borderRadius: '8px',
        pointerEvents: 'none', zIndex: 99998, boxSizing: 'border-box',
      });
      document.body.appendChild(ring);

      /* 번호 자리 — 세 가지를 함께 지켜야 합니다.
         ① 작은 단추(폭 58px 남짓)는 안쪽에 달면 글자를 덮으므로 왼쪽 밖에.
         ② 넓지만 낮은 띠(요약 줄·범례)는 안쪽 모서리에, 세로는 가운데.
         ③ 어느 경우든 **화면 밖으로 나가면 안 됩니다** — 잘라 찍는 사진에서
            딱지가 반쯤 잘려 나갑니다(실제로 그랬습니다). 끝에서 붙잡습니다. */
      const 자리 = it['자리'] || '좌상';
      let bx, by;
      if (자리 === '위') {
        /* 화면을 가로지르는 띠(요약 줄) 전용 — 왼쪽 밖은 화면 밖이라 안으로
           밀려 들어와 첫 낱말('사고지점')을 덮었습니다. 띠 **위**에 답니다. */
        bx = r.left + X + 4;
        by = r.top + Y - 36;
      } else if (r.height < 58) {
        /* 단추·입력칸처럼 낮고 좁은 것 — 안쪽에 달면 글자를 덮습니다
           (실제로 '지도에서 ② 찍기' 처럼 갈라졌습니다). 왼쪽 밖에 세웁니다. */
        bx = r.left + X - 38;
        by = r.top + Y + r.height / 2 - 16;
      } else {
        bx = /우/.test(자리) ? r.right + X - 40 : r.left + X + 8;
        by = /하/.test(자리) ? r.bottom + Y - 40 : r.top + Y + 8;
      }
      bx = Math.max(X + 4, Math.min(bx, X + document.documentElement.clientWidth - 40));
      by = Math.max(Y + 4, by);
      const b = document.createElement('div');
      b.className = 'guide-mk';
      b.textContent = String(it.n);
      Object.assign(b.style, {
        position: 'absolute', left: bx + 'px', top: by + 'px',
        width: '32px', height: '32px', borderRadius: '50%',
        background: '#de3412', color: '#fff', border: '2.5px solid #fff',
        font: '700 18px/28px system-ui, sans-serif', textAlign: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        pointerEvents: 'none', zIndex: 99999,
      });
      document.body.appendChild(b);
    });
  }, 목록);
  await page.waitForTimeout(120);
};

/* sel 을 주면 그 요소만, 자름을 주면 그 네모만 찍습니다.
   설명서에 넣을 사진은 **세로로 길면 안 됩니다** — A4 한 쪽에 사진 두 장이
   들어가야 하는데, 화면 전체를 그대로 찍으면 한 장이 쪽을 다 먹습니다. */
const 찍기 = async (page, 이름, sel, 자름) => {
  const t = sel ? await page.$(sel) : null;
  const buf = t ? await t.screenshot()
                : await page.screenshot(자름 ? { clip: 자름 } : undefined);
  writeFileSync(`${IMG}/${이름}.png`, buf);
  console.log(`  docs/guide-img/${이름}.png  ${(buf.length / 1024).toFixed(0)} KB`);
};

/* ── 첫 화면 — 세 도구가 무엇인지 그림 하나로 ─────────────────── */
{
  /* 실사 사진이 들어 있어 그대로 두면 PDF 가 6MB 를 넘습니다. 설명서에서
     보이는 크기(A4 폭 182mm)에 필요한 만큼만 잡습니다. */
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 1.25 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}index.html`);
  await p.waitForTimeout(1500);
  await 딱지(p, [
    { n: 1, sel: '.pn', i: 0 }, { n: 2, sel: '.pn', i: 1 }, { n: 3, sel: '.pn', i: 2 },
  ]);
  /* 카드 줄만 잘라 찍었었는데, 진입 화면이 **사진이 첫 화면을 가득 채우는**
     모양으로 바뀌었습니다. 카드만 실으면 담당자가 실제로 보는 화면과 달라
     "이 화면이 맞나" 싶어집니다. 화면 그대로 찍습니다. */
  await 찍기(p, '01-첫화면-pc');
  await ctx.close();

  const c2 = await browser.newContext({ viewport: 폰, deviceScaleFactor: 1.6,
    hasTouch: true, isMobile: true });
  const p2 = await c2.newPage();
  await p2.goto(`${ROOT}index.html`);
  await p2.waitForTimeout(1500);
  /* 카드 세 장이 끝나는 자리에서 자릅니다 — 화면 높이대로 찍으면 그 아래
     안내 문장이 **글 중간에서 잘려** 설명서가 고장 난 것처럼 보입니다. */
  const 끝 = await p2.evaluate(() => {
    const c = document.querySelectorAll('.pn');
    return c.length ? Math.ceil(c[c.length - 1].getBoundingClientRect().bottom) + 10 : 0;
  });
  await 찍기(p2, '02-첫화면-폰', null,
    끝 ? { x: 0, y: 0, width: 390, height: Math.min(끝, 780) } : null);
  await c2.close();
}

/* ── 01 방제 물품·장비 찾기 ──────────────────────────────────── */
/* ⚠ 이 도구는 2026-09-07 에 **세 걸음**이 되었습니다(사용자 분류안 PPT) —
     걸음 1 두 갈래(업체 섭외 / 방제물품 찾기) → 걸음 2 고르기 → 걸음 3 사고지점.
     두 갈래는 **묻는 것이 다릅니다**("어디에 맡길까" ↔ "무엇이 어디 있나").
     그래서 걸음 2 사진을 **두 장** 찍습니다 — 한 장만 실으면 다른 갈래를
     고른 사람은 자기 화면이 설명서와 다르다고 봅니다. */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(900);
  /* 이 화면의 '다음' 줄은 **늘 화면 아래에 붙어 있습니다**(sticky). 요소를
     통째로 찍으면 그 줄이 사진 **한가운데** 떠서 목록을 가로지릅니다 —
     실제로 그렇게 찍혔습니다. 사진을 찍는 동안만 제자리에 세웁니다. */
  await p.addStyleTag({ content: '.rz-nav{position:static !important}' });

  /* 아래가 빈 사진은 A4 에서 자리만 먹습니다 — 마지막 칸 밑에서 자릅니다. */
  const 끝까지 = async (sel, 더 = 24) => ({
    x: 0, y: 0, width: PC.width,
    height: Math.min(PC.height, Math.ceil(await p.evaluate(([s, m]) => {
      const e = document.querySelectorAll(s);
      return e.length ? e[e.length - 1].getBoundingClientRect().bottom + m : 0;
    }, [sel, 더]))),
  });

  /* ── 왜 옆의 빈 자리까지 잘라내나 ────────────────────────────
     설명서에서 이 두 장은 **나란히** 놓입니다(A4 폭의 절반씩). 화면 전체를
     찍어 절반으로 줄이면 글자가 3pt 가 되어 읽을 수 없습니다. 글이 든
     칸만 남기면 같은 자리에서 글자가 두 배로 커집니다.
     `위sel` 부터 `아래sel` 까지, 가로는 `기둥sel` 의 폭에 맞춥니다. */
  const 칸만 = (위sel, 아래sel, 기둥sel) => p.evaluate(([a, b, c]) => {
    const t = document.querySelector(a), d = document.querySelector(b);
    const col = document.querySelectorAll(c);
    if (!t || !d || !col.length) return null;
    let L = Infinity, R = -Infinity;
    col.forEach((e) => { const r = e.getBoundingClientRect();
      L = Math.min(L, r.left); R = Math.max(R, r.right); });
    const y = Math.max(0, Math.floor(t.getBoundingClientRect().top) - 10);
    /* 왼쪽을 46px 더 잡습니다 — 낮은 요소의 번호 딱지가 **요소 왼쪽 밖**에
       서기 때문입니다. 딱 맞춰 자르면 그 번호가 반쯤 잘립니다(그랬습니다). */
    return { x: Math.max(0, Math.floor(L) - 46), y,
             width: Math.ceil(R - L) + 62,
             height: Math.ceil(d.getBoundingClientRect().bottom - y) + 10 };
  }, [위sel, 아래sel, 기둥sel]);

  await 딱지(p, [
    { n: 1, sel: '.rz-br', i: 0 },
    { n: 2, sel: '.rz-br', i: 1 },
  ]);
  /* ⚠ y=0 에서 자르면 **상단 바와 걸음 표시까지** 들어옵니다. A4 넉 장에서는
     그 90px 이 그대로 자리를 먹고, 정작 카드 글자는 작아집니다.
     묻는 줄(#rzH0)부터 카드 밑까지, 가로도 카드 폭에 맞춰 자릅니다. */
  await 찍기(p, '10-방제-갈래', null,
    (await 칸만('#rzH0', '.rz-brs', '.rz-brs')) || await 끝까지('.rz-br'));

  /* 걸음 2 ㉮ — 업체 섭외(허가 갈래).
     딱지는 둘만 답니다 — '전부 보기' 에 달면 번호가 왼쪽 밖으로 나가
     옆의 '이전' 글자를 덮습니다(실제로 그랬습니다). 그 단추는 글로 적습니다. */
  await 딱지(p, []);
  await p.click('.rz-br >> nth=0');
  await p.waitForTimeout(400);
  await 딱지(p, [
    { n: 1, sel: '.rz-need', i: 0 },
    { n: 2, sel: '#rzNext', 자리: '우상' },
  ]);
  /* `.rz-nav` 는 걸음 2·3 에 하나씩 있습니다. 걸음 3 것은 숨어 있어 바닥이
     0 이라, 그냥 마지막 것을 재면 사진이 24px 짜리가 됩니다(그렇게 됐습니다). */
  await 찍기(p, '11-방제-업체', null,
    (await 칸만('#rzH1', '#rzP1 .rz-nav', '.rz-need')) || await 끝까지('#rzP1 .rz-nav'));

  /* 걸음 2 ㉯ — 방제물품(물품 이름). 되돌아가도 고른 것은 남습니다.
     칩이 27개라 아래로 깁니다 — 위 네 묶음까지만 자릅니다(설명서에서
     두 장을 나란히 놓는데, 한 장만 세로로 길면 줄이 어긋납니다). */
  await 딱지(p, []);
  await p.click('#rzBack0');
  await p.waitForTimeout(300);
  await p.click('.rz-br >> nth=1');
  await p.waitForTimeout(400);
  await 딱지(p, [
    { n: 1, sel: '.rz-item', i: 0 },
  ]);
  await 찍기(p, '12-방제-물품', null,
    (await 칸만('#rzH1', '.rz-igrp:nth-of-type(3)', '.rz-igrp')) || {
      x: 0, y: 0, width: PC.width, height: 700 });

  /* 결과까지 — 업체 갈래로 되돌아가 두 갈래를 고르고 사고지점을 넣습니다.
     사고지점은 좌표로 넣습니다(주소검색은 인터넷이 필요해 이 환경에서
     못 씁니다). 화면 모양은 어느 길로 넣든 같습니다. */
  await 딱지(p, []);
  await p.click('#rzBack0');
  await p.waitForTimeout(300);
  await p.click('.rz-br >> nth=0');
  await p.waitForTimeout(400);
  await p.click('.rz-need >> nth=0');
  await p.click('.rz-need >> nth=1');
  await p.waitForTimeout(200);
  await p.click('#rzNext');
  await p.waitForTimeout(400);
  await p.click('#startSkip');
  await p.waitForTimeout(700);
  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);
  await 띠가리기(p);
  await 딱지(p, [
    { n: 1, sel: '.msum', 자리: '위' },
    { n: 2, sel: '.ms-it', i: 0, 자리: '우상' },
    { n: 3, sel: '.maplegend', 자리: '좌하' },
  ]);
  await 찍기(p, '13-방제-결과');

  /* 범례만 따로 — 마커가 **색 동그라미 + 그림**이 된 것을 보여 줍니다.
     설명서에 "색이 종류" 라고만 적어 두면 그림이 왜 있는지 모릅니다. */
  await 딱지(p, []);
  await 찍기(p, '14-방제-범례', '.maplegend');

  /* 미리 협의된 곳 — 갈래마다 **맨 위**에 초록 띠로 옵니다. 사용자가
     "제일 눈에 잘 띄도록" 이라고 한 자리라 설명서에도 그림으로 넣습니다.
     23곳이 전국에 흩어져 있어 김천 반경 20km 안에는 없습니다. 그래서
     처음부터 다시 열어 **전부 보기 → 경기도**(협의된 곳 6곳)로 봅니다.
     ⚠ '전부 보기' 는 걸음 3 으로 갈 뿐이라 `#startSkip` 까지 눌러야
        목록이 나옵니다 — 안 누르면 시작 화면이 목록을 덮고 있습니다. */
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(900);
  await p.click('.rz-br >> nth=0');
  await p.waitForTimeout(300);
  await p.click('#rzAll');
  await p.waitForTimeout(500);
  await p.click('#startSkip');
  await p.waitForTimeout(900);
  await p.selectOption('#mSido', { label: '경기도' }).catch(() => {});
  await p.waitForTimeout(1000);
  const 협의 = await p.evaluate(() => {
    const f = document.querySelector('.ms-it.first');
    if (!f) return null;
    /* 한 줄만 자릅니다 — 둘째 줄까지 넣었더니 글 한가운데서 잘려
       설명서가 고장 난 것처럼 보였습니다. */
    const a = f.getBoundingClientRect();
    return { x: Math.floor(a.left) - 4, y: Math.floor(a.top) - 4,
             width: Math.ceil(a.width) + 8, height: Math.ceil(a.height) + 8 };
  });
  if (협의) await 찍기(p, '15-방제-협의된곳', null, 협의);
  else console.error('⚠ 협의된 곳(.ms-it.first)을 못 찾아 사진을 건너뜁니다');

  /* 목록 줄(또는 지도 동그라미)을 누르면 뜨는 **세부사항 창** — 이 도구에서
     정작 필요한 것이 전화번호·물품·수량이라는 사용자 지시(2026-09-08)로
     만든 자리입니다. 설명서에 지도만 실으면 담당자가 이 창을 모르고
     지나갑니다. 창만 잘라 싣습니다(화면 전체를 실으면 글자가 3pt).
     ⚠ **물품 갈래에서** 찍습니다 — 업체 갈래에는 물품·수량이 없어서, 그쪽
       화면을 실으면 "보유 물품·수량" 이라고 적어 놓고 빈 창을 보여 줍니다.
       김천 시내 좌표에서 첫 줄이 번호와 물품 여덟 가지를 가진 곳입니다. */
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(900);
  await p.click('.rz-br >> nth=1');
  await p.waitForTimeout(400);
  await p.click('.rz-item >> nth=5');
  await p.waitForTimeout(200);
  await p.click('#rzNext');
  await p.waitForTimeout(400);
  await p.click('#startSkip');
  await p.waitForTimeout(700);
  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  await p.click('#shList .ms-it >> nth=0');
  await p.waitForTimeout(900);
  const 창 = await p.evaluate(() => {
    const e = document.querySelector('.rkd');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.floor(r.left) - 4, y: Math.floor(r.top) - 4,
             width: Math.ceil(r.width) + 8, height: Math.ceil(r.height) + 8 };
  });
  if (창) await 찍기(p, '16-방제-세부창', null, 창);
  else console.error('⚠ 세부사항 창(.rkd)을 못 찾아 사진을 건너뜁니다');

  /* 목록 줄 한 개 — 무엇이 적혀 있는지(거리·물품·수량·전화)를 보이는 자리.
     ⚠ **한 줄만** 자릅니다. 목록 전체를 실으면 A4 에서 글자가 6pt 가 되고,
       줄이 잘려 설명서가 고장 난 것처럼 보입니다. 지금은 고른 줄이라
       전화·복사·담기 단추까지 펴져 있어 그대로 쓸모가 있습니다. */
  const 한줄 = await p.evaluate(() => {
    const e = document.querySelector('#shList .ms-it');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.floor(r.left) - 3, y: Math.floor(r.top) - 3,
             width: Math.ceil(r.width) + 6, height: Math.ceil(r.height) + 6 };
  });
  if (한줄) await 찍기(p, '17-방제-목록줄', null, 한줄);
  else console.error('⚠ 목록 줄(.ms-it)을 못 찾아 사진을 건너뜁니다');
  await ctx.close();
}

/* ── 02 주민 대피장소 찾기 ───────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}map/index.html`);
  await p.waitForTimeout(900);
  await 딱지(p, [
    { n: 1, sel: '#mAddrQ' },
    { n: 2, sel: '#btnAcc', 자리: '우상' },
    { n: 3, sel: '#btnMe', 자리: '우하' },
  ]);
  await 찍기(p, '20-대피장소-시작', '.mbar');

  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1400);
  await 띠가리기(p);
  await 딱지(p, [
    { n: 1, sel: '.msum', 자리: '위' },
    { n: 2, sel: '.mnear', 자리: '우상' },
    { n: 3, sel: '.ms-it', i: 0, 자리: '우상' },
  ]);
  await 찍기(p, '21-대피장소-결과');

  /* ② 의 범례도 따로 — 대피장소 마커가 **비상구 그림**이라는 것을 보여 줍니다.
     ③ 범례와 나란히 실어 "그림은 종류" 라는 규칙이 두 도구에 같음을 알립니다. */
  await 딱지(p, []);
  await 찍기(p, '22-대피장소-범례', '.maplegend');

  /* ── 나란히 실을 두 장 (지도 / 목록) ─────────────────────────
     화면 전체(1280px)를 A4 폭으로 줄이면 글자가 7pt 아래로 내려가 읽기
     어렵습니다. 그래서 **지도 칸**과 **목록 세 줄**을 따로 잘라, 각각
     A4 폭의 절반에 놓습니다 — 같은 자리에서 글자가 두 배가 됩니다. */
  const 지도칸 = await p.evaluate(() => {
    const e = document.querySelector('.mmap');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    /* 옆에 놓는 목록 사진과 높이가 비슷해야 두 장이 나란히 앉습니다.
       폭의 1.15 배까지 — 설명서 3쪽은 자리가 남아서 크게 실을 수 있습니다. */
    return { x: Math.floor(r.left), y: Math.floor(r.top),
             width: Math.ceil(r.width),
             height: Math.min(Math.ceil(r.height), Math.ceil(r.width * 1.15)) };
  });
  if (지도칸) await 찍기(p, '24-대피장소-지도', null, 지도칸);

  const 목록칸 = await p.evaluate(() => {
    const it = document.querySelectorAll('#shList .ms-it');
    const box = document.querySelector('.ms-list');
    if (!it.length || !box) return null;
    const b = box.getBoundingClientRect();
    /* **다 보이는 줄까지만** 자릅니다. 다섯째 줄이 목록 칸(스크롤 상자)
       아래로 걸쳐 있으면 그 줄이 반쯤 잘려, 읽는 사람이 화면이 깨진 줄
       압니다(실제로 그렇게 찍혔습니다). 상자 안에서 끝나는 마지막 줄을
       찾아 그 밑에서 자릅니다 — 많아도 다섯 줄. */
    let 끝 = 0, 셈 = 0;
    it.forEach((e) => {
      const r = e.getBoundingClientRect();
      if (셈 < 5 && r.bottom <= b.bottom - 1) { 끝 = r.bottom; 셈 += 1; }
    });
    if (!끝) 끝 = Math.min(b.bottom, it[0].getBoundingClientRect().bottom);
    return { x: Math.floor(b.left), y: Math.floor(b.top),
             width: Math.ceil(b.width), height: Math.ceil(끝 - b.top) };
  });
  if (목록칸) await 찍기(p, '25-대피장소-목록', null, 목록칸);

  /* '가까운 대피장소 3곳' 카드 — 지도 위에 늘 떠 있는 자리입니다.
     목록을 훑지 않아도 "그래서 어디로 보내면 되는가"가 여기 있습니다. */
  await 찍기(p, '26-대피장소-가까운3곳', '.mnear');
  await ctx.close();
}

/* ── 03 주민대피 문자생성기 ──────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}sms/index.html`);
  await p.waitForTimeout(900);
  await 딱지(p, [
    { n: 1, sel: '.steps button.stp', i: 0 },
    { n: 2, sel: '.steps button.stp', i: 1 },
    { n: 3, sel: '.steps button.stp', i: 2, 자리: '우상' },
  ]);
  /* 카드 세 장만 — 감싸는 #stepsZone 을 찍으면 위아래 안내까지 들어와
     세로 765px 이 되고, A4 폭으로 줄여도 한 쪽의 8할을 먹습니다. */
  await 찍기(p, '30-문자-발송구분', '#stages');

  await p.click('#stages button[data-s=evac]');
  await p.waitForTimeout(500);
  await 딱지(p, [
    { n: 1, sel: '#stepBar' },
    /* 입력칸 하나가 아니라 **묶음 상자**를 가리킵니다 — 설명이
       "한 화면에 한 묶음만" 이기 때문입니다. 첫 걸음(사고유형)에는
       글자 입력칸이 아예 없어, 칸을 겨냥하면 딱지가 엉뚱한 데 붙습니다. */
    { n: 2, sel: '.fgrp', i: 0 },
  ]);
  /* 위에서 620px 만 — 아래로 입력칸이 계속 이어져 그대로 찍으면 사진
     한 장이 A4 한 쪽을 다 먹습니다. */
  await 찍기(p, '31-문자-걸음', null, { x: 0, y: 0, width: 1280, height: 620 });

  /* 같은 화면을 **가운데 칸만** 다시 — 진행 표시부터 첫 입력 묶음까지.
     넉 장짜리 설명서에서는 이쪽을 씁니다(위 사진은 폭 1280 이라 A4 에서
     글자가 7pt 밑으로 내려갑니다). */
  /* 첫 걸음(사고유형)에는 **글자 입력칸이 없습니다** — 칩만 있고 `.fgrp` 는
     네 개 다 숨어 있어 높이가 0 입니다. 그대로 자르면 네모가 뒤집혀
     사진을 못 찍습니다(찍기가 시간초과로 죽었습니다). 입력칸이 보이는
     걸음으로 한 번 넘어가서 찍습니다. */
  const 다음 = await p.$('#stepNav .sn-next');
  if (다음) { await 다음.click(); await p.waitForTimeout(500); }
  /* 딱지는 **걸음 표시에만** 답니다. 묶음 상자(.fgrp)는 높아서 딱지가
     상자 **안쪽 왼쪽 위**에 서는데, 거기에 묶음 제목이 있어 글자를
     덮습니다("발송 정보 문자를 보내는 기관과 시각"이 가려졌습니다). */
  await 딱지(p, [
    { n: 1, sel: '#stepBar' },
  ]);
  const 걸음칸 = await p.evaluate(() => {
    const bar = document.querySelector('#stepBar');
    let grp = null;
    document.querySelectorAll('.fgrp').forEach((e) => {
      if (!grp && e.getBoundingClientRect().height > 24) grp = e;
    });
    if (!bar || !grp) return null;
    const a = bar.getBoundingClientRect(), b = grp.getBoundingClientRect();
    const L = Math.max(0, Math.floor(Math.min(a.left, b.left)) - 44);
    const R = Math.ceil(Math.max(a.right, b.right)) + 16;
    const y = Math.max(0, Math.floor(a.top) - 10);
    /* ⚠ 자를 네모가 **화면 밖으로 나가면 사진을 못 찍습니다**(찍기가
       시간초과로 죽습니다). 보이는 칸 안으로 붙잡습니다. */
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.clientHeight;
    return { x: L, y,
             width: Math.min(R - L, W - L),
             height: Math.min(Math.ceil(b.bottom - y) + 10, H - y) };
  });
  if (걸음칸) await 찍기(p, '34-문자-걸음칸', null, 걸음칸);
  else console.error('⚠ 걸음 칸(#stepBar·.fgrp)을 못 찾아 사진을 건너뜁니다');

  /* 필수 칸을 채워야 문안이 만들어집니다(반쪽 문안은 아예 안 만듭니다) */
  await p.evaluate(o => {
    Object.keys(o).forEach(k => {
      const el = document.getElementById('if_' + k);
      if (el) { el.value = o[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }, { 기관: '서천군', 시각: '14:20', 시군: '서천군', 읍면동: '장항읍',
       사업장: '○○화학', 대상지역: '장항읍 일원', 물질: '염산',
       대피소: '장항중학교', 집결지: '장항읍 행정복지센터' });
  await p.waitForTimeout(400);
  const b = await p.$('#stepBar button[data-go=out]');
  if (b) { await b.click(); await p.waitForTimeout(700); }
  /* 예시로 넣은 사업장명이 '○○화학' 이라 도구가 "예시값이 남아 있다"고
     경고합니다. 실제로 값을 채워 쓰면 뜨지 않는 띠인데, 설명서 사진에
     남겨 두면 읽는 사람이 자기 화면이 잘못된 줄 압니다 — 배경지도 경고를
     가리는 것과 같은 이유로 가립니다(사업장명은 그대로 예시로 둡니다). */
  await p.evaluate(() => {
    document.querySelectorAll('.alert.w').forEach(e => { e.style.display = 'none'; });
  });
  await p.waitForTimeout(150);
  await 딱지(p, [
    /* 문안 상자는 **오른쪽 아래**에 답니다 — 왼쪽 위에 달면 기관명
       ([서천군])을 덮습니다. 문안이 두 줄이라 오른쪽 아래가 비어 있습니다. */
    { n: 1, sel: '.out .msg', i: 0, 자리: '우하' },
    /* ⚠ 글자수(.cnt)에는 딱지를 달지 않습니다. 낮은 요소라 번호가 **왼쪽
       밖**에 서는데, 카드 안쪽이어서 숫자를 덮습니다 — "87 / 90자" 가
       "37 / 90자" 로 읽혔습니다. 글자수는 설명 글로만 가리킵니다. */
    { n: 2, sel: '.out footer button', i: 0, 자리: '우하' },
  ]);
  await 찍기(p, '32-문자-문안');

  /* 문안 카드 **한 장만** — 설명서에서는 이것이 이 도구의 결과물입니다.
     화면 전체를 실으면 문안 글자가 6pt 가 되어 "무엇이 만들어지는가"를
     못 보여 줍니다. 카드 하나를 잘라 A4 폭에 놓으면 문안이 그대로 읽힙니다.
     ⚠ 카드는 `.out` 입니다(`.out .card` 는 없습니다 — 그렇게 찾다가
       문안 상자만 잘려서 **글자수·복사 단추가 빠진** 사진이 실렸습니다).
       머리표(긴급재난문자)·문안·글자수·복사가 한 장에 다 들어와야
       설명서의 설명과 사진이 맞습니다. */
  const 문안 = await p.evaluate(() => {
    const e = document.querySelector('.out');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    /* 낮은 요소(글자수)의 번호 딱지는 **왼쪽 밖**에 섭니다 — 카드에 딱
       맞춰 자르면 그 번호가 반쯤 잘립니다(실제로 그랬습니다). */
    const x = Math.max(0, Math.floor(r.left) - 46);
    return { x, y: Math.floor(r.top) - 3,
             width: Math.ceil(r.right - x) + 6,
             height: Math.min(Math.ceil(r.height) + 6, 520) };
  });
  if (문안) await 찍기(p, '33-문자-문안카드', null, 문안);
  else console.error('⚠ 문안 카드(.out)를 못 찾아 사진을 건너뜁니다');
  await ctx.close();
}

/* ── 설명서를 PDF 로 굽기 ────────────────────────────────────── */
async function 굽기(원본, 낼이름, 여백) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${ROOT}docs/${원본}`);
  await p.waitForLoadState('load');
  await p.waitForTimeout(1200);
  const out = `${RPATH}/docs/${낼이름}`;
  await p.pdf({ path: out, format: 'A4', printBackground: true,
    margin: { top: 여백, bottom: 여백, left: 여백, right: 여백 } });
  await ctx.close();
  const size = readFileSync(out).length;
  const 쪽 = (readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`\ndocs/${낼이름}   ${(size / 1024).toFixed(0)} KB · ${쪽}쪽`);
  return { out, 쪽 };
}

const 설명서 = await 굽기('사용설명서.html', '화학사고_초동대응_지원_서비스_사용설명서.pdf', '12mm');
const 한장 = await 굽기('원페이퍼.html', '화학사고_초동대응_지원_서비스_한장요약.pdf', '9mm');

/* 원페이퍼는 한 쪽이어야 합니다 — 두 쪽이면 '한 장 요약'이 아니고
   붙여 둘 수도 없습니다. */
if (한장.쪽 > 1) {
  console.error(`\n⚠ 원페이퍼가 ${한장.쪽}쪽이 되었습니다 — 내용을 줄이거나 `
    + `docs/원페이퍼.html 의 글자·여백을 줄이세요.`);
  process.exitCode = 1;
} else {
  console.log('  원페이퍼 한 쪽 확인');
}

/* 설명서는 **A4 넉 장**이어야 합니다 — 2026-09-08 사용자 지시
   ("페이지는 많아서는 안돼. A4용지 4장이면 좋겠어").
   한 쪽이라도 넘치면 마지막 쪽에 몇 줄만 남은 반쪽이 생기고, 넉 장으로
   출력해 나눠 주려던 것이 어긋납니다. */
if (설명서.쪽 !== 4) {
  console.error(`\n⚠ 설명서가 ${설명서.쪽}쪽이 되었습니다 — 넉 장이어야 합니다.`
    + ` 사진 높이나 글을 줄이세요(쪽마다 .page 하나).`);
  process.exitCode = 1;
} else {
  console.log('  설명서 넉 장 확인');
}

/* 설명서에 글이 다시 불어나지 않게 셉니다. 사용자가 "글은 최대한 줄이고
   그림으로" 라고 한 것이 이 설명서의 조건입니다 — 예전 판이 5,900자였고
   지금은 그 3분의 1 밑입니다. 넘어가면 알려만 주고 멈추지는 않습니다. */
{
  const src = readFileSync(`${RPATH}/docs/사용설명서.html`, 'utf8')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ');
  const 글자 = src.replace(/\s+/g, ' ').trim().length;
  console.log(`  설명서 글자 ${글자}자 (예전 5,910자)`);
  if (글자 > 2200) console.error(`⚠ 글이 다시 늘었습니다 — 그림으로 옮길 수 있는지 보세요.`);
}

await browser.close();
console.log('→ 사진을 다시 찍고 설명서를 다시 구웠습니다.');
