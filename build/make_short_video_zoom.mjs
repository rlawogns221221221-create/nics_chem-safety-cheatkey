// 결선 발표용 30초 영상 「줌인 판」 — 첫 화면의 카드 넷에서 하나씩 들어가 도구를 보여 줍니다
//
//   node build/make_short_video_zoom.mjs [나갈파일.mp4]   # 기본 docs/공모전_결선_30초_줌.mp4
//
// ── 왜 만드나 (2026-11-20 사용자) ──
// "영상 여러 버젼으로 만들어 갈거야 … 첫화면에 4가지 도구가 보이고 거기서 한개씩 줌인
// 되듯이 들어가서 각 도구를 설명하는 방식". 첫 판(make_short_video.mjs →
// docs/공모전_결선_30초.mp4)은 마음에 든다고 해서 **그대로 두고** 따로 만듭니다.
//
// ── 어떻게 만드나 ──
// 1) 첫 화면(index.html)을 휴대전화 크기로 찍고 카드 넷의 자리를 실제 요소에서 잽니다.
//    무대(build/영상30_줌무대.html)가 그 사진을 휴대전화 틀에 넣고, 카메라가 잰 자리로
//    들어갑니다 — 첫 화면을 고쳐도 다시 돌리면 맞습니다.
// 2) 도구마다 시연 화면은 **이미 구운 시연영상(docs/공모전_시연영상.mp4)에서 잘라 씁니다**
//    — 그 영상은 액션에서 배경지도까지 받아 구운 것이고(이 환경은 지도 타일을 못 받음 ·
//    CLAUDE.md 6절), 업체명·전화번호도 이미 흐리게 가려져 있습니다. 원본 영상은 장면마다
//    카메라가 휴대전화를 확대하는데 그 구간을 자르면 화면이 엉뚱하게 잘리므로 **확대 전
//    구간만** 골랐습니다(아래 `조각`). 원본을 다시 구우면 이 숫자를 다시 보세요.
// 3) 카드에서 들어간 뒤 화면 가득 까는 사진은 첫 화면 카드와 같은 **원본 사진**
//    (source/photos)입니다 — 카드 사진(1200px)을 키우면 뭉개집니다.
// 4) 음악은 build/make_short_music_zoom.py(120 BPM) — 무대의 시각과 맞물려 있습니다.
import { chromium } from 'playwright';
import path from 'path';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 원본 = path.join(ROOT, 'docs/공모전_시연영상.mp4');
const 나감 = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'docs/공모전_결선_30초_줌.mp4');
const 작업 = path.join(ROOT, '.narr/영상30줌');
const FPS = 30;
const 길이 = 30;
const T = [4, 10, 16, 22];          // 무대·음악과 같은 값 — 도구 제목이 뜨는 순간

// 휴대전화 화면이 원본 영상에서 차지하는 자리(1920×1080 기준) — 첫 판과 같음
const 화면자리 = 'crop=506:964:387:58';
// 첫 화면을 찍는 크기 — 시연 화면(506×964)과 같은 비율이라야 휴대전화 틀에 꼭 맞음
const 첫화면 = { width: 390, height: Math.round(390 * 964 / 506) };

// [도구 번호, 이름, 원본 시작초, 원본 끝초, 무대에서 쓸 길이(초)]
// 한 도구의 시연은 제목 뒤 0.75초부터 3.5초 — 그 안에 한두 조각
const 조각 = [
  [0, '01', 58.5, 63.5, 3.5],      // 대피장소 목록 → 가는 길이 지도에 그려짐
  [1, '02', 119.3, 122.3, 3.5],    // 문안 만들기 → 표준문안 완성(확대 전까지)
  [2, '03a', 159.8, 161.3, 1.2],   // 업체 목록 — 미리 협의된 곳이 맨 위
  [2, '03b', 176.6, 179.0, 2.3],   // 방제물품 세부 창 — 보유 물품·수량
  [3, '04a', 207.5, 211.0, 2.1],   // 바람 고르기 → 방호활동 구역 안
  [3, '04b', 212.5, 214.5, 1.4],   // 지도 위 구역과 내 위치
];
// 무대 시각 → 어느 조각인가(조각이 이어지는 순서대로 시작 시각을 셈)
const 배치 = [];
{
  const 다음 = {};
  for (const [k, 이름, , , d] of 조각) {
    const s = 다음[k] ?? T[k] + 0.75;
    배치.push([s, 이름]);
    다음[k] = s + d;
  }
}
const 사진 = [
  // 첫 화면 카드와 같은 사진 · 같은 기준점(build/make_site_images.py 의 anchor)
  { src: 'source/photos/card-map.webp', pos: '50% 46%' },
  // 02 는 사진 속 휴대전화 글자가 제목 자리에 겹쳐 사진을 키워 오른쪽으로 옮김(가장자리가 비지 않는 만큼만)
  { src: 'source/photos/card-sms.webp', pos: '0% 50%', move: 'translateX(390px) scale(1.28)' },
  { src: 'source/photos/card-res.webp', pos: '50% 56%' },
  { src: 'source/photos/hero-4.webp', pos: '50% 50%' },   // 04 카드는 머리띠 ④ 를 잘라 씀
];

function ff(args) { execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); }

if (!existsSync(원본)) throw new Error('원본 시연영상이 없습니다: ' + 원본);
rmSync(작업, { recursive: true, force: true });
mkdirSync(path.join(작업, '장면'), { recursive: true });

const browser = await chromium.launch();

// 1) 첫 화면을 휴대전화 크기로 찍고 카드 자리를 잼(움직임 줄이기 — 머리띠 사진이 첫 장에 섬)
const 허브 = path.join(작업, '허브.png');
let 카드;
{
  const p = await browser.newPage({ viewport: 첫화면, deviceScaleFactor: 4, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  카드 = await p.evaluate(() => [...document.querySelectorAll('li.pn')].map((li) => {
    const r = li.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height, li.querySelector('a').getAttribute('href')];
  }));
  // 카드 차례가 01 대피장소 → 02 문자 → 03 방제 → 04 안전거리 인지 확인(CLAUDE.md 7절)
  const 차례 = 카드.map((c) => c[4].split('/')[0]).join(',');
  if (차례 !== 'map,sms,res,safe') throw new Error('첫 화면 카드 차례가 다릅니다: ' + 차례);
  for (const c of 카드) if (c[1] + c[3] > 첫화면.height) throw new Error('카드가 첫 화면 아래로 잘립니다: ' + c);
  await p.screenshot({ path: 허브 });
  await p.close();
}

// 2) 조각마다 휴대전화 화면을 잘라 무대 길이에 맞춰 빠르기를 바꿔 사진으로 뽑음
for (const [, 이름, a, b, d] of 조각) {
  const 폴더 = path.join(작업, 이름);
  mkdirSync(폴더);
  const 배율 = d / (b - a);
  // -t 는 -i 앞(입력 쪽)에 둡니다 — 뒤에 두면 '내보낼 길이'가 되어, 느리게 늘린 조각이 원본 길이에서 잘립니다
  ff(['-ss', String(a), '-t', String(b - a), '-i', 원본,
    '-vf', `${화면자리},setpts=(PTS-STARTPTS)*${배율.toFixed(5)},fps=${FPS}`,
    '-frames:v', String(Math.round(d * FPS)), '-q:v', '2', path.join(폴더, '%04d.jpg')]);
  // 반올림으로 끝에서 한두 장 모자랄 수 있음 — 무대가 마지막 장을 잡아 두므로 괜찮음
  const n = readdirSync(폴더).length;
  if (n < Math.round(d * FPS) * 0.9) throw new Error(`${이름}: 장면 ${n}장 — 모자람`);
}

// 3) 배경음악
const 음악 = path.join(작업, '음악30줌.wav');
execFileSync('python3', [path.join(ROOT, 'build/make_short_music_zoom.py'), 음악], { stdio: 'inherit' });

// 4) 무대를 한 장씩 찍음
const 화면파일 = (t) => {
  let 쓸 = null;
  for (const [s, 이름] of 배치) if (t >= s) 쓸 = [s, 이름];
  if (!쓸) 쓸 = 배치[0];
  const 폴더 = path.join(작업, 쓸[1]);
  const 장수 = readdirSync(폴더).length;
  const i = Math.min(장수, Math.max(1, Math.floor((t - 쓸[0]) * FPS) + 1));
  return 'file://' + path.join(폴더, String(i).padStart(4, '0') + '.jpg');
};
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(ROOT, 'build/영상30_줌무대.html'));
await page.evaluate((o) => window.준비(o), {
  허브: 'file://' + 허브,
  css폭: 첫화면.width,
  카드: 카드.map((c) => c.slice(0, 4)),
  사진: 사진.map((s) => ({ src: 'file://' + path.join(ROOT, s.src), pos: s.pos, move: s.move })),
});
const 장수 = 길이 * FPS;
for (let k = 0; k < 장수; k++) {
  const t = k / FPS;
  await page.evaluate(([t, src]) => window.화면(src).then(() => window.장면(t)), [t, 화면파일(t)]);
  await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  if (k % 150 === 0) console.log(`찍는 중 ${k}/${장수}`);
}
await browser.close();

// 5) 사진 + 음악 → mp4. 음악은 첫 판과 같은 손질(살짝 울림 · 크기 고르게 · -14 LUFS)
ff(['-framerate', String(FPS), '-i', path.join(작업, '장면', 'f%04d.jpg'), '-i', 음악,
  '-filter_complex', '[1:a]aecho=0.8:0.55:45|95:0.16|0.09,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 나감]);
console.log('만듦', 나감);
