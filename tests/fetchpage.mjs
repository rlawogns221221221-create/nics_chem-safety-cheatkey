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

/* ── 집계표를 받았을 때 — 빈 파일을 만들면 안 된다 ──────────────
   사용자가 실제로 이 자료(시·도별 개소·수용능력만 있는 51줄짜리 통계표)를
   받아 왔고, 그때 아무 말 없이 0줄짜리 파일이 만들어져 무엇이 잘못됐는지
   알 수 없었다. 그 일이 다시 없게 여기서 잡는다. */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api_agg.json');
await P.waitForTimeout(700);
chk(await P.isHidden('#dlCard'), '쓸 줄이 없으면 내려받기 단추를 주지 않는다');
chk(!!(await P.$('.bad')), '왜 안 되는지 화면에 뜬다');
const why = await P.textContent('.bad');
chk(why.includes('시·도별 집계표'), '집계표를 받았다고 짚어 준다');
chk(why.includes('시설명') && why.includes('위도'), '어떤 칸이 있어야 하는지 알려 준다');
chk(why.includes('개소') && why.includes('수용능력'), '받은 자료의 칸 이름을 그대로 보여 준다');

/* ── safetydata.go.kr 모양 — 줄이 body 에 담기고 칸 이름이 영문 약어다 ──────
   사용자가 이 자료의 인증키를 받아 왔는데, 개발 자리에서는 그 서버로 나갈 수
   없어 실제 칸 이름을 확인하지 못했다. 여기서 재는 것은 "내 짐작이 맞다"가
   아니라 **모양이 달라도 페이지가 버티는지** 다 — 줄이 data 가 아니라 body 에
   담겨 와도 읽고, 코드 칸(SIG_CD)을 이름 자리에 넣지 않고, 서버가 200 으로
   답하면서 몸통에 담아 보낸 오류를 "0건" 으로 넘기지 않는지. */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
chk(await P.inputValue('#url') === 'https://www.safetydata.go.kr/V2/api/DSSP-IF-10945',
    '기본 자료 주소가 새 오픈API 다');
await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api_safety.json');
await P.waitForTimeout(700);
const log2 = await P.textContent('#log');
/* 여러 쪽을 한꺼번에 고를 수 있게 되면서 문구가 "파일 N개에서 읽음" 이 되었습니다
   (이 자료는 한 번에 1,000줄까지만 와서 15,911건이면 16쪽입니다). */
chk(/파일 1개에서 읽음 — 3건/.test(log2), `줄이 body 에 담겨 와도 읽는다 — ${log2.trim().split('\n').pop()}`);
const cols2 = await P.textContent('#cols');
[['시설명','FCLT_NM'],['위도','LAT'],['경도','LOT'],['수용인원','ACPT_PSN_CPCTY'],
 ['면적','TOT_AR'],['관리기관','MNG_INST_NM'],['전화','MNG_INST_TELNO'],
 ['도로명','RONA_DADDR'],['지번','LNM_ADDR']].forEach(([k, v]) =>
  chk(cols2.includes(k) && cols2.includes(v), `영문 약어 짝짓기: ${k} ← ${v}`));
/* #cols 는 줄바꿈 없이 이어진 글이라 통째로 견주면 '안 쓴 칸' 에 적힌 것까지
   걸린다(처음에 그렇게 짰다가 헛되게 실패했다). 줄마다 따로 본다. */
const pair2 = await P.$$eval('#cols div', ds => ds.map(d => d.textContent));
chk(pair2.some(t => /안 쓴 칸/.test(t) && t.includes('SIG_CD')),
    '코드 칸(SIG_CD)을 이름 자리에 넣지 않는다');
chk((await P.textContent('#rawBox')).includes('FCLT_NM'),
    '원자료 첫 줄을 그대로 보여 준다 — 짝이 틀리면 이것을 보내면 된다');
const [dl2] = await Promise.all([P.waitForEvent('download'), P.click('#dl')]);
const ctx2 = {};
new Function('w', fs.readFileSync(await dl2.path(), 'utf-8').replace(/^var /gm, 'w.'))(ctx2);
chk(!!(ctx2.TEMPSHELTERS['경기도'] && ctx2.TEMPSHELTERS['경기도']['성남시']),
    '영문 약어 자료도 대피장소 자료와 같은 지역 이름으로 묶인다');
chk(!ctx2.TEMPSHELTERS['충청남도'], '좌표 없는 줄은 여기서도 안 들어간다');

/* ── 진짜 자료 — 2026-09-08 사용자가 보내 준 실제 응답에서 뽑은 네 줄 ──────
   여기까지는 "모양이 달라도 버티는가" 를 재는 것이었고, 이제는 **실제 칸 이름으로
   제대로 읽는가** 를 잽니다. 짐작으로 둔 규칙 두 개가 틀려 있었습니다 —
   수용인원(NMPR)이 통째로 비었고, 시도(KOREAN_CTPRVN_NM)를 못 잡았습니다.
   같은 실수가 되풀이되지 않게 실제 이름을 여기에 박아 둡니다. */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api_real.json');
await P.waitForTimeout(700);
const cols3 = await P.$$eval('#cols div', ds => ds.map(d => d.textContent));
const 짝 = (k, v) => chk(cols3.some(t => t.indexOf(k) === 0 && t.includes(v)),
  `진짜 칸 이름: ${k} ← ${v}`);
짝('시설명', 'VT_ACMDFCLTY_NM');
짝('시도', 'KOREAN_CTPRVN_NM');
짝('지번', 'DTL_ADRES');
짝('위도', 'LA'); 짝('경도', 'LO');
짝('수용인원', 'VT_ACMD_PSBL_NMPR');
짝('면적', 'FCLTY_AR');
/* 이 자료에 없는 것 — 지어내지 않는다 */
['시설구분', '관리기관', '전화'].forEach(k =>
  chk(cols3.some(t => t.indexOf(k) === 0 && t.includes('원자료에 없음')),
      `${k} 는 이 자료에 없으므로 비워 둔다`));
/* RN_DTL_ADRES 는 값이 "경로당" 인 **건물 안 자리 이름**이다 — 주소로 쓰면
   목록에 "경로당" 이 주소로 찍힌다. SGG_RN 은 번지 없는 길 이름이다. */
chk(cols3.some(t => /안 쓴 칸/.test(t) && t.includes('RN_DTL_ADRES')),
    'RN_DTL_ADRES(건물 안 자리 이름)를 주소로 쓰지 않는다');
chk(cols3.some(t => /안 쓴 칸/.test(t) && t.includes('SGG_RN')),
    'SGG_RN(번지 없는 길 이름)을 주소로 쓰지 않는다');

const [dl3] = await Promise.all([P.waitForEvent('download'), P.click('#dl')]);
const ctx3 = {};
new Function('w', fs.readFileSync(await dl3.path(), 'utf-8').replace(/^var /gm, 'w.'))(ctx3);
const T3 = ctx3.TEMPSHELTERS;
const 원주 = (T3['강원특별자치도'] || {})['원주시'] || [];
chk(원주.length === 3, `강원 원주시 3곳 — ${원주.length}`);
const 경로당 = 원주.filter(r => r[0] === '행구촌경로당')[0];
chk(!!경로당 && 경로당[3] === 63, `수용인원이 들어간다 — ${경로당 && 경로당[3]}`);
chk(!!경로당 && 경로당[1] === '164㎡', `면적 — ${경로당 && 경로당[1]}`);
chk(!!경로당 && /원주시 살구둑길/.test(경로당[2]), `주소 — ${경로당 && 경로당[2]}`);
chk(!!경로당 && 경로당[7] === '' && 경로당[8] === '', '관리기관·전화는 빈칸으로 둔다');
chk(!!(T3['세종특별자치시'] && T3['세종특별자치시']['null']),
    '세종은 대피장소 자료와 같은 열쇠(null)로 들어간다');
chk(!원주.some(r => r[2] === '경로당'), '"경로당" 이 주소 자리에 들어가지 않는다');

/* ── 쪽을 여러 개 한꺼번에 고르기 ────────────────────────────
   이 자료는 한 번에 **1,000줄까지만** 옵니다(서버가 numOfRows 를 깎습니다).
   총 15,911건이면 16쪽이라, 주소창에서 저장하는 길로 가면 파일이 16개가 됩니다.
   한 개씩만 받으면 앞의 것이 지워져 마지막 쪽만 남습니다 — 그 실수를 여기서 잡습니다.
   2쪽 fixture 의 마지막 줄은 1쪽과 **일부러 겹쳐** 두었습니다(겹쳐 저장하는 일이
   흔합니다). 겹친 줄이 두 번 들어가면 지도에 마커가 겹칩니다. */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
await P.setInputFiles('#file', [RPATH + '/tests/fixtures/sample_api_real.json',
                                RPATH + '/tests/fixtures/sample_api_real2.json']);
await P.waitForTimeout(900);
const log4 = await P.textContent('#log');
chk(/파일 2개에서 읽음 — 7건/.test(log4), `쪽 두 개를 이어 붙인다 — ${log4.trim().split('\n').pop()}`);
chk(/겹쳐서 뺀 줄 1/.test(log4), '겹쳐 저장한 줄은 한 번만 넣는다');
const [dl4] = await Promise.all([P.waitForEvent('download'), P.click('#dl')]);
const ctx4 = {};
new Function('w', fs.readFileSync(await dl4.path(), 'utf-8').replace(/^var /gm, 'w.'))(ctx4);
chk(ctx4.TEMPSHELTER_META.총건수 === 7, `합쳐서 7곳 — ${ctx4.TEMPSHELTER_META.총건수}`);
chk((ctx4.TEMPSHELTERS['강원특별자치도']['원주시'] || [])
      .filter(r => r[0] === '행구촌경로당').length === 1, '겹친 시설이 두 번 찍히지 않는다');

/* 서버가 200 으로 답하면서 몸통에 오류를 담아 보낸 경우 */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api_err.json');
await P.waitForTimeout(600);
const log3 = await P.textContent('#log');
chk(log3.includes('서버 오류') && log3.includes('인증키'),
    `몸통에 담긴 오류를 0건으로 넘기지 않는다 — ${log3.trim().split('\n').pop()}`);
chk(await P.isHidden('#dlCard'), '오류 응답으로는 파일을 만들지 않는다');

/* ── 서버가 "IP 가 등록 안 됐다" 고 답할 때 ────────────────────
   2026-09-07 깃허브 액션에서 실제로 이 오류를 받았습니다("32 UNREGISTERED IP
   ERROR"). 이 오픈API 는 활용신청 때 적어 둔 IP 에서만 받아집니다.
   코드만 띄우면 사용자가 무엇을 해야 하는지 알 수 없으므로, **무엇을 하면
   되는지**가 화면에 나와야 합니다. */
await P.goto(ROOT + 'build/fetch_tempshelter.html');
await P.waitForTimeout(400);
await P.setInputFiles('#file', RPATH + '/tests/fixtures/sample_api_iperr.json');
await P.waitForTimeout(700);
const ipTxt = (await P.textContent('.card')).replace(/\s+/g, ' ');
chk(/IP/.test(ipTxt) && /등록/.test(ipTxt),
  'IP 가 등록 안 됐다는 오류를 그대로 짚어 준다');
chk(/마이페이지|활용 IP|활용신청/.test(ipTxt),
  '어디를 눌러 고치는지 알려 준다');
chk(/파일로 내려받아|JSON 파일로 하기/.test(ipTxt),
  '막혔을 때 대신 갈 길(파일로 받기)도 알려 준다');
chk(await P.isHidden('#dlCard'), 'IP 오류로는 파일을 만들지 않는다');

console.log('PASS ' + ok.length + ' / FAIL ' + bad.length);
bad.forEach(m => console.log('  FAIL ' + m));
if (errs.length) { console.log('오류:'); errs.forEach(e => console.log('  ' + e)); }
await B.close();
