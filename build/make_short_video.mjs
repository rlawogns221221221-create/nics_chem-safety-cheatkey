// 결선 발표용 30초 영상 — 시연영상(4분 36초)에서 장면을 골라 30초로 다시 엮습니다
//
//   node build/make_short_video.mjs [나갈파일.mp4]      # 기본 docs/공모전_결선_30초.mp4
//
// ── 왜 만드나 (2026-11-20 사용자) ──
// 결선은 발표 5분 · 질의응답 4분입니다. 발표 중에 4분 36초 영상을 틀 수 없어
// "전체 설명 10초 + 도구별 5초 × 4 = 30초" 로 다시 만듭니다. 나레이션은 빼고
// 긴박한 배경음악만 씁니다(build/make_short_music.py).
//
// ── 왜 이렇게 만드나 ──
// · 휴대전화 화면은 **이미 구운 시연영상(docs/공모전_시연영상.mp4)에서 잘라 씁니다.**
//   그 영상은 액션에서 배경지도까지 받아 구운 것이고, 이 개발 환경은 지도 타일을
//   받지 못합니다(CLAUDE.md 6절). 새로 찍으면 지도가 빈 화면이 됩니다.
//   업체명·전화번호도 그 영상에서 이미 흐리게 가려져 있습니다.
// · 잘라 쓰는 구간은 아래 `조각` 에 초 단위로 적었습니다. 원본 영상은 장면마다
//   카메라가 휴대전화를 확대하는데(예: 122.5초~ · 179.5초~), 그 구간을 자르면
//   화면이 엉뚱하게 잘리므로 **확대 전 구간만** 골랐습니다. 원본 영상을 다시 구우면
//   이 숫자를 다시 확인하세요(1초 간격 사진을 찍어 보면 됩니다).
// · 글자·움직임은 build/영상30_무대.html 이 시간 t 마다 계산해 그리고, 그것을
//   한 장씩 찍어(30장/초) 영상으로 묶습니다. 장면 시각은 144 BPM 박자에 맞춰
//   음악의 큰 북과 같은 순간에 바뀝니다.
import { chromium } from 'playwright';
import path from 'path';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 원본 = path.join(ROOT, 'docs/공모전_시연영상.mp4');
const 나감 = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'docs/공모전_결선_30초.mp4');
const 작업 = path.join(ROOT, '.narr/영상30');
const FPS = 30;
const 길이 = 30;
const 박 = 60 / 144;

// 휴대전화 화면이 원본 영상에서 차지하는 자리(1920×1080 기준) — 화면만 잘라 무대의 테두리에 끼움
const 화면자리 = 'crop=506:964:387:58';

// [이름, 원본 시작초, 원본 끝초, 무대에서 쓸 길이(초)]
const 조각 = [
  ['첫화면', 6.0, 6.0 + 10 - 16 * 박, 10 - 16 * 박],   // 서비스 이름 장면(6.67~10초) 뒤 첫 화면
  ['01', 58.5, 63.5, 5.0],      // 대피장소 목록 · 가는 길이 지도에 그려짐
  ['02a', 112.0, 116.0, 2.0],   // 사고물질 '암모니아' 를 쳐서 고름
  ['02b', 119.3, 122.3, 3.0],   // 문안 만들기 → 표준문안 완성(확대 전까지)
  ['03a', 159.4, 161.3, 2.0],   // 업체 목록 — 미리 협의된 곳이 맨 위
  ['03b', 176.6, 179.4, 3.0],   // 방제물품 세부 창 — 보유 물품·수량
  ['04a', 206.5, 211.0, 2.8],   // 바람 고르기 → 방호활동 구역 안
  ['04b', 212.0, 215.0, 2.2],   // 지도 위 구역과 내 위치
];
// 무대 시각 → 어느 조각의 몇 번째 장면인가
const 배치 = [
  [16 * 박, '첫화면'], [10, '01'], [15, '02a'], [17, '02b'], [20, '03a'], [22, '03b'], [25, '04a'], [27.8, '04b'],
];

function ff(args) { execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); }

if (!existsSync(원본)) throw new Error('원본 시연영상이 없습니다: ' + 원본);
rmSync(작업, { recursive: true, force: true });
mkdirSync(path.join(작업, '장면'), { recursive: true });

// 1) 조각마다 휴대전화 화면을 잘라 무대 길이에 맞춰 빠르기를 바꿔 사진으로 뽑음
for (const [이름, a, b, d] of 조각) {
  const 폴더 = path.join(작업, 이름);
  mkdirSync(폴더);
  const 배율 = d / (b - a);
  ff(['-ss', String(a), '-i', 원본, '-t', String(b - a),
    '-vf', `${화면자리},setpts=(PTS-STARTPTS)*${배율.toFixed(5)},fps=${FPS}`,
    '-frames:v', String(Math.round(d * FPS)), '-q:v', '2', path.join(폴더, '%04d.jpg')]);
  // 느리게 늘린 조각은 끝에서 몇 장 모자랄 수 있음 — 무대가 마지막 장을 잡아 두므로 괜찮음.
  // 원본을 더 길게 자르지 않는 것은, 바로 뒤가 카메라 확대 구간인 조각이 있어서입니다.
  const n = readdirSync(폴더).length;
  if (n < Math.round(d * FPS) * 0.9) throw new Error(`${이름}: 장면 ${n}장 — 모자람`);
}

// 2) 배경음악
const 음악 = path.join(작업, '음악30.wav');
execFileSync('python3', [path.join(ROOT, 'build/make_short_music.py'), 음악], { stdio: 'inherit' });

// 3) 무대를 한 장씩 찍음
const 화면파일 = (t) => {
  let 쓸 = null;
  for (const [s, 이름] of 배치) if (t >= s) 쓸 = [s, 이름];
  if (!쓸) return null;
  const 폴더 = path.join(작업, 쓸[1]);
  const 장수 = readdirSync(폴더).length;
  const i = Math.min(장수, Math.max(1, Math.floor((t - 쓸[0]) * FPS) + 1));
  return 'file://' + path.join(폴더, String(i).padStart(4, '0') + '.jpg');
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(ROOT, 'build/영상30_무대.html'));
await page.evaluate(() => document.fonts.ready);
const 장수 = 길이 * FPS;
for (let k = 0; k < 장수; k++) {
  const t = k / FPS;
  await page.evaluate(([t, src]) => window.화면(src).then(() => window.장면(t)), [t, 화면파일(t)]);
  await page.screenshot({ path: path.join(작업, '장면', 'f' + String(k).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  if (k % 150 === 0) console.log(`찍는 중 ${k}/${장수}`);
}
await browser.close();

// 4) 사진 + 음악 → mp4. 음악은 살짝 울림을 주고 크기를 고르게 한 뒤 -14 LUFS 로 맞춤
ff(['-framerate', String(FPS), '-i', path.join(작업, '장면', 'f%04d.jpg'), '-i', 음악,
  '-filter_complex', '[1:a]aecho=0.8:0.55:45|95:0.16|0.09,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=4,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(길이), '-movflags', '+faststart', 나감]);
console.log('만듦', 나감);
