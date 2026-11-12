/* 보고서에 싣는 **깨끗한** 휴대전화 화면 사진 (붉은 고리 없음)
   ───────────────────────────────────────────────────────────────
       node build/make_phone_shots.mjs        (개발 자리 — 배경지도 없음 · 구성 확인용)
       Actions → "휴대전화 화면 사진 굽기"      (러너 — 배경지도까지 나옴 · 내는 판)

   ── 왜 따로 찍나 (2026-11-12) ─────────────────────────────────
   원내 「AI프런티어 사례」 보고서의 휴대전화 화면 칸에 04 현장 안전거리 확인 화면이
   없었습니다(사용자 — "휴대전화 화면 부분도 바뀌어야 하는데 그대로야").
   휴대전화 사용설명서 사진(docs/모바일설명서)에는 **누를 곳에 붉은 고리**가 박혀 있어,
   고리 없는 다른 화면들 옆에 두면 그 칸만 무엇을 가리키는지 모를 표시가 남습니다.
   그래서 같은 상황을 고리 없이 다시 찍습니다.

   ── 상황 ────────────────────────────────────────────────────────
   설명서 04 쪽과 같습니다 — 여수 산단, 암모니아, 대규모, 남서풍, 근무자 자리에서
   남서쪽 약 700m 가 사고지점 → 내 위치가 「방호활동 구역 안」. 실제 회사 이름이
   들어가지 않습니다(사고지점은 「내 위치로 찍기」로 정함).

   ── 크기 ────────────────────────────────────────────────────────
   390×845 · 2배 = 780×1690. 보고서의 다른 휴대전화 사진(사용자 휴대전화로 찍은
   640×1387)과 가로세로 비가 같아 표 칸에 나란히 놓으면 높이가 맞습니다.
   ⚠ 자막·안내를 손으로 그려 넣지 않습니다 — 찍힌 그대로 냅니다(CLAUDE.md 2절). */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));
const OUT = `${RPATH}/docs/휴대전화화면`;
mkdirSync(OUT, { recursive: true });

/* 시간대를 한국으로 — 없으면 러너 시각(UTC)으로 일출·일몰이 그려집니다(설명서에서 겪음) */
const 폰 = { ...devices['iPhone 13'], viewport: { width: 390, height: 845 }, deviceScaleFactor: 2,
  timezoneId: 'Asia/Seoul', locale: 'ko-KR' };
const 문제 = [];
const browser = await chromium.launch();

/* 이 환경에서만 뜨는 띠(배경지도 못 받음 · 인터넷 검색 못 씀)는 가립니다.
   스타일 한 줄로 막아야 타일을 받을 때 화면이 다시 그려도 도로 안 켜집니다. */
const 띠가리기 = (p) => p.evaluate(() => {
  if (document.getElementById('__shotHide')) return;
  const s = document.createElement('style');
  s.id = '__shotHide';
  s.textContent = '#mWarn,.mbar-warn,.alert.w,.shmap-warn,.mpk-busy{display:none!important}'
    + '*{caret-color:transparent!important}';
  document.head.appendChild(s);
});
const 찍기 = async (p, 이름) => {
  await 띠가리기(p);
  await p.waitForTimeout(1500);              // 배경지도 타일이 다 들어올 시간
  await p.screenshot({ path: `${OUT}/${이름}.png` });
  console.log(`  ${이름}.png`);
};
const 붙이기 = (p, sel, 위 = 8) => p.evaluate(([s, y]) => {
  const e = document.querySelector(s);
  if (e) scrollTo(0, scrollY + e.getBoundingClientRect().top - y);
}, [sel, 위]);

/* ── 04 현장 안전거리 확인 ──────────────────────────────────────── */
{
  const 나 = { latitude: 34.7905, longitude: 127.6520, accuracy: 15 };
  const 사고 = { latitude: 34.7905 - 495 / 111000, longitude: 127.6520 - 495 / 91180, accuracy: 15 };
  const ctx = await browser.newContext({ ...폰, permissions: ['geolocation'], geolocation: 사고 });
  const p = await ctx.newPage();
  await p.goto(`${ROOT}safe/index.html`);
  await p.waitForTimeout(1100);
  await p.click('#sfMat');
  await p.type('#sfMat', '암모', { delay: 60 });
  await p.waitForTimeout(800);
  await p.locator('.mpk:not(#addrPop) .mpk-row', { hasText: '암모니아' }).first().click();
  await p.waitForTimeout(600);
  await p.click('#btnHereAcc');               // 사고지점 = 지금 이 자리(그다음 근무자 자리로 옮김)
  await p.waitForTimeout(1500);
  await p.click('#segSize button[data-v="l"]');
  await p.click('#windBtn');
  await p.waitForTimeout(500);
  await p.click('#windPop .wr-b[data-deg="225"]');
  await p.waitForTimeout(600);
  await ctx.setGeolocation(나);
  await p.click('#btnWatch');
  await p.waitForTimeout(2000);
  /* 「내 위치를 계속 확인합니다」 알림은 몇 초 뒤 저절로 사라지는 것이라 미리 닫습니다 */
  await p.evaluate(() => { const t = document.getElementById('mToast'); if (t) t.hidden = true; });
  if (!(await p.$('#sfStat .sf-pt.me.pad'))) 문제.push('04: 내 위치가 방호활동 구역 안으로 나오지 않음');
  await p.evaluate(() => scrollTo(0, 0));
  await 찍기(p, '04-안전거리-처음');          // 조건(물질·사고지점·규모·바람) + 상태
  await 붙이기(p, '#sfStat', 4);
  await 찍기(p, '04-안전거리-구역');          // 상태 + 지도 위 두 구역 · 내 위치
  await 붙이기(p, '.sf-tbl', 120);
  await 찍기(p, '04-안전거리-표');            // 안전거리 표
  await ctx.close();
}

await browser.close();
if (문제.length) {
  console.error('⚠ 고칠 것\n  ' + 문제.join('\n  '));
  process.exit(1);
}
console.log(`끝 — ${OUT}`);
