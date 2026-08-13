/* 새 지도 기능 점검 — ② 대피장소: 내 위치 · 도보시간 · 3곳 카드 · 경로선 */
import { chromium } from 'playwright';
/* 저장소를 어디에 두어도 돌게 — 이 파일 자리에서 저장소 뿌리를 찾는다.
     ROOT  file:///…/   (뒤에 / 있음)
     RDIR  file:///…    (뒤에 / 없음)
     RPATH /…           (scheme 없는 경로) */
/* URL 생성자를 쓰지 않습니다 — 스크립트가 URL 이라는 이름을 쓰는 곳이 있어
   가려집니다(bug1.mjs). 문자열만 잘라 씁니다. */
const ROOT = import.meta.url.replace(/[^/]*$/, '').replace(/tests\/$/, '');
const RDIR = ROOT.replace(/\/$/, '');
const RPATH = decodeURIComponent(RDIR.replace(/^file:\/\//, ''));
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = []; const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);

/* 위치 권한을 허용하고 좌표를 고정해 둔다 (여수 산단 부근) */
const ctx = await B.newContext({
  viewport: { width: 1600, height: 950 },
  permissions: ['geolocation'],
  geolocation: { latitude: 36.1400, longitude: 128.1137, accuracy: 45 },
});
const P = await ctx.newPage();
P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
P.on('console', m => { if (m.type() === 'error' && !/TUNNEL|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
await P.goto(`file://${RPATH}/map/index.html`); await P.waitForTimeout(700);

// ══ 내 위치 ══
chk((await P.$$('#btnMe')).length === 1, '내 위치 단추 있음');
await P.click('#btnMe'); await P.waitForTimeout(1500);
/* 내 위치를 사고지점으로 찍은 직후에는 둘이 같은 자리다. 십자와 파란 점을
   겹쳐 그리면 무엇이 무엇인지 알 수 없으므로 십자 하나로 합친다. */
chk((await P.$$('#map circle.me')).length === 0, '같은 자리면 마커를 겹쳐 그리지 않음');
chk((await P.textContent('#map text.acclbl')).includes('내 위치'),
  `라벨 하나에 둘 다 적음 ("${await P.textContent('#map text.acclbl')}")`);
chk(!(await P.isHidden('#mToast')), '결과 알림 표시');
chk((await P.textContent('#mToast')).includes('사고지점으로'), '무엇을 했는지 알려줌');
/* 오차 원은 화면에서 점보다 작아지면 그리지 않는다 — 파란 점 밑에 깔린
   3px 짜리 원은 정보가 아니라 얼룩이다. 확대해서 확인한다. */
chk((await P.$$('#map circle.meacc')).length === 0, '오차 원이 점보다 작으면 안 그림');
for (let i = 0; i < 5; i++) { await P.click('#zIn'); await P.waitForTimeout(180); }
await P.waitForTimeout(400);
chk((await P.$$('#map circle.meacc')).length === 1, '확대하면 오차 범위 원이 보임');
for (let i = 0; i < 5; i++) { await P.click('#zOut'); await P.waitForTimeout(180); }
await P.waitForTimeout(400);
chk((await P.$$eval('#maplegend, .maplegend .dot.me', e => e.length)) > 0, '범례에 내 위치 추가');
const lat = await P.inputValue('#acLat');
chk(Math.abs(parseFloat(lat) - 36.1400) < 0.001, `사고지점이 없으면 내 위치로 찍힘 (${lat})`);

// ══ 가까운 3곳 카드 ══
await P.waitForTimeout(400);
chk(!(await P.isHidden('#mNear')), '가까운 3곳 카드 표시');
const rows = await P.$$eval('.mnear-it', e => e.length);
chk(rows > 0 && rows <= 3, `카드에 최대 3줄 (${rows}줄)`);
const times = await P.$$eval('.mnear-t em', e => e.map(x => x.textContent.trim()));
chk(times.length === rows && times.every(t => /^(도보|차로) /.test(t)),
  `줄마다 이동시간 (${times.join(' / ')})`);
const dists = await P.$$eval('.mnear-d', e => e.map(x => x.textContent.trim()));
const toM = s => (/km/.test(s) ? parseFloat(s) * 1000 : parseFloat(s));
chk(dists.every((d, i) => i === 0 || toM(d) >= toM(dists[i - 1]) - 1),
  `가까운 순 (${dists.join(' → ')})`);

// 카드를 누르면 그 곳이 골라지고 경로선이 그려진다
await P.click('.mnear-it >> nth=0'); await P.waitForTimeout(700);
chk((await P.$$('#map path.route')).length === 1, '경로선(굵은 선) 그려짐');
chk((await P.$$('#map path.route-cas')).length === 1, '흰 테두리도 함께 (배경지도 위 가독성)');
const w = await P.$eval('#map path.route', e => parseFloat(getComputedStyle(e).strokeWidth));
chk(w >= 4, `경로선이 충분히 굵음 (${w}px)`);
chk((await P.textContent('#map text.linklbl')).includes('분'), '경로선에 이동시간 표시');
chk((await P.$$('.mnear-it.on')).length === 1, '고른 줄이 카드에 표시됨');

// ══ 목록 이동시간 ══
const l6 = await P.$$eval('#shList .l6 em', e => e.map(x => x.textContent.trim()));
chk(l6.length > 0 && l6.every(t => /^(도보|차로) /.test(t)), `목록에도 이동시간 (${l6.length}줄)`);
chk((await P.textContent('#mSum')).includes('분'), '요약 줄에도 이동시간');

// 걸어갈 수 없는 거리는 차로로 바뀌는가
const far = await P.evaluate(() => [MAPCORE.trip(500).label, MAPCORE.trip(2500).label,
                                    MAPCORE.trip(4000).label, MAPCORE.trip(30000).label]);
chk(far[0].startsWith('도보') && far[1].startsWith('도보')
    && far[2].startsWith('차로') && far[3].startsWith('차로'),
  `3km 넘으면 차로로 전환 (${far.join(' / ')})`);
chk(MAPCORE_check(await P.evaluate(() => MAPCORE.trip(1000).min)), '1km 도보 = 우회 감안 약 20분');
function MAPCORE_check(m) { return m >= 17 && m <= 23; }

// ══ 카드 접기·펴기 ══ (넓은 화면이므로 펴진 채로 시작한다)
chk(!(await P.$eval('#mNear', e => e.classList.contains('folded'))), '넓은 화면에서는 펴진 채로 시작');
await P.click('#mNear .mnear-h'); await P.waitForTimeout(300);
chk(await P.$eval('#mNear', e => e.classList.contains('folded')), '머리표를 누르면 접힌다');
chk((await P.$$('#mNear .mnear-it')).length === 0, '접히면 목록 줄이 사라져 지도를 비워 준다');
await P.click('#mNear .mnear-h'); await P.waitForTimeout(300);
chk((await P.$$('#mNear .mnear-it')).length === 3, '다시 누르면 펴진다 (되돌릴 수 있음)');

// ══ 유리 패널 ══
const glass = await P.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.maplegend'));
  return { bf: s.backdropFilter || s.webkitBackdropFilter, bg: s.backgroundColor };
});
chk(/blur/.test(glass.bf), `지도 위 패널에 유리 효과 (${glass.bf})`);
chk(/rgba/.test(glass.bg), `반투명 배경 (${glass.bg})`);

// ══ 초기화 ══
await P.click('#btnClear'); await P.waitForTimeout(700);
chk((await P.$$eval('#map circle.me, #map circle.meacc', e => e.length)) === 0,
  '초기화하면 내 위치도 지워짐');
chk(await P.isHidden('#mNear'), '초기화하면 카드도 사라짐');

// ══ 사고지점이 이미 있으면 파란 점을 따로 찍는다 ══
const K = await ctx.newPage();
K.on('pageerror', e => errs.push('KEEP: ' + e.message));
await K.goto(`file://${RPATH}/map/index.html`); await K.waitForTimeout(600);
await K.fill('#acLat', '36.1600'); await K.fill('#acLon', '128.1500');
await K.dispatchEvent('#acLat', 'input'); await K.waitForTimeout(900);
await K.click('#btnMe'); await K.waitForTimeout(1600);
chk((await K.inputValue('#acLat')) === '36.16', '이미 찍힌 사고지점은 그대로 둠');
chk((await K.$$('#map circle.me')).length === 1, '떨어져 있으면 내 위치를 따로 표시');
chk(!(await K.textContent('#map text.acclbl')).includes('내 위치'), '사고지점 라벨은 그대로');
chk(/그대로 두었습니다/.test(await K.textContent('#mToast')), '건드리지 않았다고 알려줌');
await K.close();

// ══ 위치를 못 쓸 때 안내 ══
/* 원인별로 다른 안내가 나오는지 본다. 브라우저 권한창을 실제로 띄울 수는
   없으므로 getCurrentPosition 이 각 오류코드로 실패하도록 바꿔 끼운다. */
for (const [code, want, label] of [[1, /권한/, '권한 거부'],
                                   [2, /실외|실내|신호/, '신호 없음'],
                                   [3, /오래 걸/, '시간 초과']]) {
  const c = await B.newContext({ viewport: { width: 1400, height: 900 } });
  await c.addInitScript(`navigator.geolocation.getCurrentPosition =
    (okc, errc) => errc({ code: ${code} });`);
  const D = await c.newPage();
  D.on('pageerror', e => errs.push('DENY: ' + e.message));
  await D.goto(`file://${RPATH}/map/index.html`); await D.waitForTimeout(600);
  await D.click('#btnMe'); await D.waitForTimeout(500);
  const t = await D.textContent('#mToast');
  chk(want.test(t), `${label} — 원인과 할 일을 알려줌: "${t.slice(0, 46)}…"`);
  chk(await D.$eval('#mToast', e => e.className.includes('err')), `${label} — 실패로 눈에 띄게 표시`);
  chk((await D.$$('#map circle.me')).length === 0, `${label} — 엉뚱한 점을 찍지 않음`);
  chk(!(await D.inputValue('#acLat')), `${label} — 사고지점도 건드리지 않음`);
  await c.close();
}

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length + '\n');
ok.forEach(m => console.log('  ok  ' + m));
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('\nJS 오류:'); [...new Set(errs)].forEach(e => console.log('  ' + e)); }
await B.close();
process.exit(bad.length || errs.length ? 1 : 0);
