// 결선 발표용 30초 영상 「줌인 판」 — 첫 화면의 카드 넷에서 하나씩 들어가 도구를 보여 줍니다
//
//   node build/make_short_video_zoom.mjs [나갈파일.mp4]   # 기본 docs/공모전_결선_30초_줌.mp4
//   node build/make_short_video_zoom.mjs --소리만          # 화면은 그대로 두고 음악만 다시 합성해 갈아 끼움
//   node build/make_short_video_zoom.mjs --판2            # 판 2 → docs/공모전_결선_30초_줌2.mp4 (아래)
//   node build/make_short_video_zoom.mjs --판2 --미리 16.5,18.5,19.8   # 그 순간만 사진으로(확인용)
//
// ── 판 2 (2026-11-22 사용자) ──
// "방제 물품 찾는 장면에서 … 상황실로 바로 전화를 할 수 있는 기능이 … 시연 화면에 표현이 될 수
// 있었으면" · "각 카트별로 설명이 … 한 줄 말고 한 2줄 정도로" · "지금 노래는 너무 완벽하고 마음에 들어".
// · 음악·시각·카메라는 첫 줌인 판과 **똑같습니다**(같은 make_short_music_zoom.py · 같은 무대).
// · 도구마다 설명이 두 줄입니다(아래 `두줄`). 말은 서비스 첫 화면 카드의 설명(index.html 의 .pn-d)과
//   시연 화면에 실제로 나오는 것에서만 가져왔습니다 — 새 주장을 얹지 않습니다(CLAUDE.md 2절 5항).
// · 03 시연은 공모전 시연영상(11-09) 대신 **새로 녹화한 화면**(build/record_res_call.mjs →
//   source/녹화/상황실_원본.*)입니다 — 상황실 전화 링크가 11-18 에 들어가 옛 영상에 없습니다.
//   무대가 그 줄을 왼쪽에 크게 띄우고 누르는 순간을 보여 줍니다.
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
import { existsSync, mkdirSync, rmSync, readdirSync, copyFileSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 원본 = path.join(ROOT, 'docs/공모전_시연영상.mp4');
const 판2 = process.argv.includes('--판2');
const 미리인자 = process.argv.indexOf('--미리');
const 미리 = 미리인자 > 0 ? process.argv[미리인자 + 1].split(',').map(Number) : null;
const 인자 = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--미리');
const 소리만 = process.argv.includes('--소리만');
const 나감 = 인자[0] ? path.resolve(인자[0])
  : path.join(ROOT, 판2 ? 'docs/공모전_결선_30초_줌2.mp4' : 'docs/공모전_결선_30초_줌.mp4');
const 작업 = path.join(ROOT, 판2 ? '.narr/영상30줌2' : '.narr/영상30줌');
const 상황실영상 = path.join(ROOT, 'source/녹화/상황실_원본.mp4');
const 상황실표 = path.join(ROOT, 'source/녹화/상황실_원본.json');
const FPS = 30;
const 길이 = 30;
const T = [4, 10, 16, 22];          // 무대·음악과 같은 값 — 도구 제목이 뜨는 순간

// 휴대전화 화면이 원본 영상에서 차지하는 자리(1920×1080 기준) — 첫 판과 같음
const 화면자리 = 'crop=506:964:387:58';
// 첫 화면을 찍는 크기 — 시연 화면(506×964)과 같은 비율이라야 휴대전화 틀에 꼭 맞음
const 첫화면 = { width: 390, height: Math.round(390 * 964 / 506) };

// [도구 번호, 이름, 원본 시작초, 원본 끝초, 무대에서 쓸 길이(초), (판 2 의 03 만) 다른 원본]
// 한 도구의 시연은 제목 뒤 0.75초부터 3.5초 — 그 안에 한두 조각
let 조각 = [
  [0, '01', 58.5, 63.5, 3.5],      // 대피장소 목록 → 가는 길이 지도에 그려짐
  [1, '02', 119.3, 122.3, 3.5],    // 문안 만들기 → 표준문안 완성(확대 전까지)
  [2, '03a', 159.8, 161.3, 1.2],   // 업체 목록 — 미리 협의된 곳이 맨 위
  [2, '03b', 176.6, 179.0, 2.3],   // 방제물품 세부 창 — 보유 물품·수량
  [3, '04a', 207.5, 211.0, 2.1],   // 바람 고르기 → 방호활동 구역 안
  [3, '04b', 212.5, 214.5, 1.4],   // 지도 위 구역과 내 위치
];
// 판 2 — 도구마다 두 줄 [첫 줄, 둘째 줄, 둘째 줄에서 주황으로 띄울 말].
// 말의 근거: 첫 화면 카드 설명(index.html .pn-d) · 각 시연 화면에 실제로 나오는 것.
const 두줄 = [
  ['사고지점 주변 대피장소를 가까운 순으로', '고른 곳까지 가는 길을 지도에 바로', ''],
  ['사고정보를 넣으면 재난문자 표준문안 완성', '빈칸 없이 채워, 바로 복사', ''],
  ['맡길 업체·필요한 물품을 가까운 순으로', '비상연락망은 누르면 상황실로 바로 전화', '상황실로 바로 전화'],
  ['물질과 사고지점을 넣으면 ERG 구역을 지도에', '내 위치가 그 안인지 바로 확인', ''],
];
/* 판 2 · 03 — 새 녹화본에서 쓸 구간과 무대 시각.
   상황실 줄이 보이는 때('목록') 조금 앞부터 3.5초 — 누름('전화')이 그 안에 들어옵니다.
   실제 빠르기 그대로 씁니다(사람이 누르는 속도 그대로). */
let 돋 = null;
if (판2 && !소리만) {
  if (!existsSync(상황실영상) || !existsSync(상황실표))
    throw new Error('03 상황실 녹화본이 없습니다 — build/record_res_call.mjs 를 먼저 돌리세요(액션 「결선 영상 줌인 판 2 굽기」)');
  const 기록 = JSON.parse(readFileSync(상황실표, 'utf8'));
  if (기록.문제 && 기록.문제.length) throw new Error('03 녹화에 고칠 것이 남았습니다: ' + 기록.문제.join(' / '));
  const 표 = (k) => { const m = 기록.표.find((x) => x.k === k); if (!m) throw new Error('녹화 기록에 없음: ' + k); return m; };
  const 탭 = 기록.누름[기록.누름.length - 1];
  const a = 표('목록').t - 0.25, d = 3.5, b = a + d;
  if (b > 표('끝').t) throw new Error('03 녹화가 짧습니다');
  if (탭.t < a || 탭.t > b - 1.2) throw new Error('누름이 시연 구간의 알맞은 자리에 있지 않습니다');
  조각 = 조각.filter((g) => g[0] !== 2);
  조각.splice(2, 0, [2, '03', a, b, d, 상황실영상]);
  const 무대 = (rt) => T[2] + 0.75 + (rt - a);            // 녹화 초 → 무대 초(빠르기 1배)
  돋 = { k: 2, css폭: 기록.화면.width, css높이: 기록.화면.height,
    자리: 표('목록').줄머리, 탭점: { x: 탭.x, y: 탭.y },
    탭: 무대(탭.t), 보임: Math.max(T[2] + 1.35, 무대(탭.t) - 0.9) };
  console.log(`03 — 녹화 ${a.toFixed(2)}~${b.toFixed(2)}초 · 누름 무대 ${돋.탭.toFixed(2)}초 · 배경지도 타일 ${기록.배경지도타일}장`);
}
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

/* 음악 손질 — 살짝 울림 · 크기 고르게 · -14 LUFS.
   울림은 짧은 되울림(45·95ms) 대신 넓게 퍼지는 네 겹(60~270ms)입니다 — 짧은 되울림은 북소리
   뒤에 '딱' 을 한 번 더 붙여 총소리처럼 들리게 했습니다(2026-11-22 사용자). */
const 소리손질 = '[1:a]aecho=0.8:0.7:60|120|190|270:0.12|0.09|0.06|0.04,'
  + 'acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]';
const 음악만들기 = (파일) => execFileSync('python3', [path.join(ROOT, 'build/make_short_music_zoom.py'), 파일], { stdio: 'inherit' });

/* --소리만 — 화면(900장)을 다시 찍지 않고 이미 구운 영상의 화면에 새 음악만 얹습니다.
   화면은 다시 압축하지 않고 그대로 옮깁니다(-c:v copy). */
if (소리만) {
  if (!existsSync(나감)) throw new Error('갈아 끼울 영상이 없습니다: ' + 나감);
  mkdirSync(작업, { recursive: true });
  const 새음악 = path.join(작업, '음악30줌.wav'), 임시 = path.join(작업, '소리만.mp4');
  음악만들기(새음악);
  ff(['-i', 나감, '-i', 새음악, '-filter_complex', 소리손질, '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 임시]);
  copyFileSync(임시, 나감);
  console.log('소리만 갈아 끼움', 나감);
  process.exit(0);
}

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
for (const [, 이름, a, b, d, 딴원본] of 조각) {
  const 폴더 = path.join(작업, 이름);
  mkdirSync(폴더);
  const 배율 = d / (b - a);
  // -t 는 -i 앞(입력 쪽)에 둡니다 — 뒤에 두면 '내보낼 길이'가 되어, 느리게 늘린 조각이 원본 길이에서 잘립니다
  // 새 녹화본(판 2 의 03)은 휴대전화 화면만 받은 것이라 잘라 낼 것이 없습니다(같은 비율 · 2배 크기)
  ff(['-ss', String(a), '-t', String(b - a), '-i', 딴원본 || 원본,
    '-vf', `${딴원본 ? '' : 화면자리 + ','}setpts=(PTS-STARTPTS)*${배율.toFixed(5)},fps=${FPS}`,
    '-frames:v', String(Math.round(d * FPS)), '-q:v', '2', path.join(폴더, '%04d.jpg')]);
  // 반올림으로 끝에서 한두 장 모자랄 수 있음 — 무대가 마지막 장을 잡아 두므로 괜찮음
  const n = readdirSync(폴더).length;
  if (n < Math.round(d * FPS) * 0.9) throw new Error(`${이름}: 장면 ${n}장 — 모자람`);
}

// 3) 배경음악 — 판 2 도 같은 음악(사용자가 마음에 들어 함 · 같은 스크립트로 같은 소리)
const 음악 = path.join(작업, '음악30줌.wav');
if (!미리) 음악만들기(음악);

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
  ...(판2 ? { 줄: 두줄, 돋 } : {}),
});
// --미리 — 고른 순간만 사진으로 찍고 끝(무대를 고칠 때 확인용)
if (미리) {
  for (const t of 미리) {
    await page.evaluate(([t, src]) => window.화면(src).then(() => window.장면(t)), [t, 화면파일(t)]);
    const f = path.join(작업, `미리_${t}.png`);
    await page.screenshot({ path: f });
    console.log('찍음', f);
  }
  await browser.close();
  process.exit(0);
}
const 장수 = 길이 * FPS;
for (let k = 0; k < 장수; k++) {
  const t = k / FPS;
  await page.evaluate(([t, src]) => window.화면(src).then(() => window.장면(t)), [t, 화면파일(t)]);
  await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  if (k % 150 === 0) console.log(`찍는 중 ${k}/${장수}`);
}
await browser.close();

// 5) 사진 + 음악 → mp4 (음악 손질은 위 `소리손질`)
ff(['-framerate', String(FPS), '-i', path.join(작업, '장면', 'f%04d.jpg'), '-i', 음악,
  '-filter_complex', 소리손질,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 나감]);
console.log('만듦', 나감);
