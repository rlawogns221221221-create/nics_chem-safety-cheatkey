/* 바탕화면 아이콘 굽기 — build/icon.svg → assets/img/icon-*.png
   ───────────────────────────────────────────────────────────────
       node build/make_icons.mjs

   ── 왜 PNG 로 굽는가 ────────────────────────────────────────────
   아이폰의 "홈 화면에 추가"(apple-touch-icon)는 **SVG 를 읽지 않습니다.**
   안드로이드 매니페스트도 SVG 지원이 기기마다 들쭉날쭉합니다. 그래서
   원본은 SVG 한 장으로 두되 실제로 쓰는 것은 PNG 로 미리 구워 둡니다.

   ── 왜 Pillow 가 아니라 브라우저인가 ────────────────────────────
   Pillow 는 SVG 를 못 읽습니다(래스터 전용). 이 저장소는 검증에 이미
   Chromium 을 쓰고 있으므로, 새 도구를 들이지 않고 그것으로 그립니다.

   ── 크기를 이렇게 잡은 이유 ─────────────────────────────────────
     192  안드로이드 홈 화면 (매니페스트 최소 요구)
     512  설치 화면·스플래시 (매니페스트 최소 요구)
     180  아이폰 홈 화면 (apple-touch-icon 표준 크기)
   더 잘게 나눠 굽지 않습니다 — 브라우저가 알아서 줄여 씁니다. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

/* URL 생성자를 쓰지 않습니다 — 문자열만 잘라 씁니다(tests/tok.mjs 와 같은 이유) */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/build\/$/, '');
const RPATH = decodeURIComponent(ROOT.replace(/^file:\/\//, '').replace(/\/$/, ''));

const SVG = readFileSync(`${RPATH}/build/icon.svg`, 'utf8');
const SIZES = [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'icon-180.png'],
];

const browser = await chromium.launch();
for (const [size, name] of SIZES) {
  /* deviceScaleFactor 를 1 로 두고 창 크기를 목표 크기로 잡습니다 —
     화면 배율이 끼면 정확히 그 픽셀이 안 나옵니다. */
  const page = await browser.newPage({ viewport: { width: size, height: size },
                                       deviceScaleFactor: 1 });
  /* 바탕을 투명으로 두면 안드로이드가 검게 채우는 기기가 있습니다.
     아이콘 자체가 파랑 사각형으로 가득 차 있으므로 문제될 일은 없지만,
     혹시 여백이 생겨도 파랑이 되도록 body 에도 같은 색을 깔아 둡니다. */
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:#256ef4}
      svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`);
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(`${RPATH}/assets/img/${name}`, buf);
  console.log(`  assets/img/${name}  ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
  await page.close();
}
await browser.close();
console.log('→ 아이콘을 다시 구웠습니다. manifest.webmanifest 는 이 이름들을 부릅니다.');
