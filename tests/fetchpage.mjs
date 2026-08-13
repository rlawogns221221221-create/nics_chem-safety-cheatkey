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
const P = await B.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
const errs = []; P.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
const ok = [], bad = []; const chk = (c, m) => (c ? ok : bad).push(m);
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
chk(await P.evaluate(() => !!window.SHELTERS), '대피장소 자료를 읽어 지역 이름을 맞춘다');

await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api.json');
await P.waitForTimeout(600);

const cols = await P.textContent('#cols');
[['시설명','시설명'],['위도','위도'],['경도','경도'],['수용인원','최대수용인원'],
 ['시설구분','시설구분'],['면적','시설면적'],['관리기관','관리기관명'],['전화','관리기관전화번호'],
 ['도로명','도로명주소'],['지번','지번주소']].forEach(([k, v]) =>
  chk(cols.includes(k) && cols.includes(v), `칸 짝짓기: ${k} ← ${v}`));

const rows = await P.$$eval('#prev table tr', trs =>
  trs.slice(1).map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)));
const log = await P.textContent('#log');
chk(log.includes('쓸 수 있는 줄 5 / 받은 줄 6'), `좌표 없는 줄을 뺀다 — ${log.trim().split('\n').pop()}`);

const [dl] = await Promise.all([P.waitForEvent('download'), P.click('#dl')]);
const path = await dl.path();
const fs = await import('fs');
const js = fs.readFileSync(path, 'utf-8');
chk(dl.suggestedFilename() === 'tempshelters.js', `파일 이름: ${dl.suggestedFilename()}`);
const ctx = {};
new Function('w', js.replace(/^var /gm, 'w.'))(ctx);
const T = ctx.TEMPSHELTERS;
chk(!!T, '만들어진 파일이 실행된다');
chk(!!(T['경기도'] && T['경기도']['성남시']), '경기 성남시 분당구 → 경기도 / 성남시');
chk(!!(T['강원특별자치도'] && T['강원특별자치도']['강릉시']), '강원도 → 강원특별자치도');
chk(!!(T['전북특별자치도'] && T['전북특별자치도']['익산시']), '시·도 칸이 비어도 주소에서 찾는다');
chk(!!(T['세종특별자치시'] && T['세종특별자치시']['null']), '세종은 대피장소 자료와 같은 열쇠(null)로');
chk(!!(T['울산광역시'] && T['울산광역시']['울주군']), '울산 울주군');
chk(!T['충청남도'], '좌표 없는 줄은 아예 안 들어간다');
const r = T['경기도']['성남시'][0];
chk(r[0] === '판교초등학교 체육관' && r[1] === '1,200㎡' && r[3] === 250
    && r[4] === '이재민임시주거시설' && r[5] === 37.39 && r[6] === 127.11
    && r[8] === '031-000-0000', `줄 내용: ${JSON.stringify(r)}`);
chk(ctx.TEMPSHELTER_META && ctx.TEMPSHELTER_META.총건수 === 5, '메타에 건수가 들어간다');
chk(!js.includes('serviceKey') && !js.includes('인증키'), '만든 파일에 인증키가 들어가지 않는다');

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length);
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('오류:'); errs.forEach(e => console.log('  ' + e)); }
await B.close();
