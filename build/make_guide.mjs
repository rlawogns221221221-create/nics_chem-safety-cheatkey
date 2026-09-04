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
      if (r.height < 58) {
        /* 단추·입력칸·띠처럼 낮은 것 — 안쪽에 달면 글자를 덮습니다
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
  await 찍기(p, '01-첫화면-pc', 'main .wrap');
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
{
  const ctx = await browser.newContext({ viewport: PC, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}res/index.html`);
  await p.waitForTimeout(900);
  await 딱지(p, [
    { n: 1, sel: '.rz-need', i: 0 },
    { n: 2, sel: '.rz-skip', 자리: '좌하' },
    { n: 3, sel: '#rzNext', 자리: '우상' },
  ]);
  await 찍기(p, '10-방제-걸음1', '.rz');

  await p.click('.rz-need >> nth=0');
  await p.click('.rz-need >> nth=1');
  await p.waitForTimeout(200);
  await p.click('#rzNext');
  await p.waitForTimeout(400);
  await 딱지(p, [
    { n: 1, sel: '.rz input[type=text]', i: 0 },
    { n: 2, sel: '#startPick', 자리: '좌하' },
  ]);
  await 찍기(p, '11-방제-걸음2', '.rz');

  /* 사고지점을 좌표로 넣어 결과 화면까지 — 주소검색은 인터넷이 필요해
     이 환경에서 못 씁니다. 화면 모양은 어느 길로 넣든 같습니다. */
  await p.click('#startSkip');
  await p.waitForTimeout(700);
  await p.fill('#acLat', '36.1195');
  await p.fill('#acLon', '128.1135');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);
  await 띠가리기(p);
  await 딱지(p, [
    { n: 1, sel: '.msum' },
    { n: 2, sel: '.ms-it', i: 0, 자리: '우상' },
    { n: 3, sel: '.maplegend', 자리: '좌하' },
  ]);
  await 찍기(p, '12-방제-결과');
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
    { n: 1, sel: '.msum' },
    { n: 2, sel: '.mnear', 자리: '우상' },
    { n: 3, sel: '.ms-it', i: 0, 자리: '우상' },
  ]);
  await 찍기(p, '21-대피장소-결과');
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
    { n: 1, sel: '.out .msg', i: 0 },
    { n: 2, sel: '.out .cnt', i: 0, 자리: '우상' },
    { n: 3, sel: '.out footer button', i: 0, 자리: '우하' },
  ]);
  await 찍기(p, '32-문자-문안');
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
