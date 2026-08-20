# KRDS 요약 — 우리 도구에 쓸 값만 뽑은 것

사용자가 **KRDS HTML ComponentKit(krds-uiux 1.1.0)** 과 디자인 리소스(sketch·xd)를
건네주었습니다(2026-08-20). 아래는 그 원자료에서 실제로 확인한 값입니다.
**추측이 아니라 파일에서 읽은 값**이며, 원본은 `source/krds/` 에 그대로 두었습니다.

원본 위치
- `assets/krds/krds_tokens.css` — 공식 디자인 토큰 (원본 그대로 · 손으로 고치지 말 것)
- `assets/fonts/PretendardGOV-{Regular,Bold}.subset.woff2` — 공식 서체 (부분집합)
- `source/krds/scss/` — 컴포넌트 규격 원본(SCSS). 값을 찾을 때 여기를 봅니다
- `source/krds/transformed_tokens.json` — 같은 토큰의 JSON 판

---

## 1. 색 — Primitive

색마다 5·10·20·30·40·50·60·70·80·90·95 열한 단계입니다(회색만 0·100 추가).
**50이 기준색**입니다.

| 역할 | 5 | 10 | 50 (기준) | 60 | 90 |
|---|---|---|---|---|---|
| primary | `#ecf2fe` | `#d8e5fd` | **`#256ef4`** | `#0b50d0` | `#03163a` |
| secondary | `#eef2f7` | `#d6e0eb` | **`#346fb2`** | `#1c589c` | `#031f3f` |
| danger (위험) | `#fdefec` | `#fcdfd9` | **`#de3412`** | `#bd2c0f` | `#390d05` |
| warning (주의) | `#fff3db` | `#ffe0a3` | **`#ffb114`** | — | — |
| success (완료) | `#eaf6ec` | `#d8eedd` | **`#228738`** | — | — |
| information (안내) | `#e7f4fe` | `#d3ebfd` | **`#0b78cb`** | `#096ab3` | `#03253f` |

회색 — `0 #ffffff` · `5 #f4f5f6` · `10 #e6e8ea` · `20 #cdd1d5` · `30 #b1b8be` ·
`40 #8a949e` · `50 #6d7882` · `60 #58616a` · `70 #464c53` · `80 #33363d` ·
`90 #1e2124` · `95 #131416` · `100 #000000`

## 2. 색 — 쓰는 이름(Semantic)

토큰 파일이 `--krds-light-color-…` 로 역할별 이름을 따로 줍니다. 우리 CSS 는
**이 이름을 통해서만** 색을 씁니다(숫자 단계를 직접 쓰지 않습니다).

```
surface-white / surface-gray-subtler / surface-primary-subtler …   바탕
border-gray / border-primary / border-danger …                     선
text-basic / text-primary / text-danger …                          글자
action-primary / action-secondary …                                누르는 것
```

## 3. 모드 — 밝음 / 고대비

**KRDS 에는 '다크 모드'라는 이름이 없고, 대신 `고대비(high-contrast)` 모드가 있습니다.
그 모드가 사실상 어두운 화면입니다** — `surface-white` 가 `gray-100(#000000)`,
`surface-gray-subtler` 가 `gray-95(#131416)` 로 바뀝니다.

켜는 방법도 정해져 있습니다.

```html
<html data-krds-mode="light">           <!-- 밝음 -->
<html data-krds-mode="high-contrast">   <!-- 고대비(어두움) -->
<html data-krds-mode="theme">           <!-- 기기 설정을 따름 -->
```

즉 **어두운 화면을 원하면 우리가 색을 새로 만들 필요가 없습니다.** 공식 고대비
모드를 켜면 됩니다.

## 4. 글자

- 서체 `Pretendard GOV` — Regular(400) · Bold(700) **두 굵기만** 씁니다
- 뿌리 글자크기를 `62.5%`(=10px) 로 두고 `rem` 으로 적습니다 → `1.7rem = 17px`

| 이름 | PC | 모바일 |
|---|---|---|
| display-large | 6rem (60px) | 4.4rem |
| display-medium | 4.4rem | 3.2rem |
| heading-xlarge | 4rem | 2.8rem |
| heading-large | 3.2rem | 2.4rem |
| heading-medium | 2.4rem | 2.2rem |
| heading-small | 1.9rem | 1.9rem |
| **body-medium (기준)** | **1.7rem (17px)** | 1.7rem |
| body-small | 1.5rem | 1.5rem |
| body-xsmall | 1.3rem | 1.3rem |
| label-large / medium / small | 1.9 / 1.7 / 1.5rem | 같음 |

줄높이는 150% 이상. 자간은 0 또는 0.1rem 만 씁니다.

## 5. 크기·간격 — number 계단

간격·높이·모서리가 모두 이 계단에서 나옵니다.

```
0:0  1:0.1  2:0.2  3:0.4  4:0.6  5:0.8  6:1.0  7:1.2  8:1.6  9:2.0  10:2.4
11:2.8  12:3.2  13:3.6  14:4.0  15:4.4  16:4.8  17:5.6  18:6.4  19:7.2  20:8.0  (rem)
```

모서리 — xsmall `2px` · small `4px` · medium1·2 `6px` · medium3·4 `8px` ·
large `10px` · xlarge `12px` · max `1000px`

## 6. 버튼 크기 (`source/krds/scss/component/_button.scss`)

| 이름 | 높이 | 좌우 여백 | 모서리 | 글자 |
|---|---|---|---|---|
| xsmall | 32px | 10px | 4px | 1.5rem |
| small | 40px | 12px | 6px | 1.5rem |
| medium | 48px | 16px | 6px | 1.7rem |
| **large** | **56px** | **20px** | **8px** | **1.9rem** |
| xlarge | 64px | 24px | 8px | 1.9rem |

## 7. 레이아웃

- 본문 폭 1200px · 좌우 여백 24px(PC)
- 초점 표시(focus)는 `0 0 0 0.4rem border-primary` — **4px 두께 파란 테두리**.
  KRDS 가 못 박아 둔 값이므로 우리가 바꾸지 않습니다.

---

## 우리 도구에 적용할 때 조심할 것

1. **토큰 파일은 손으로 고치지 않습니다.** 맨 위에 `Do not edit directly` 라고
   적혀 있습니다. 값을 바꿔야 하면 우리 쪽 별칭 변수를 만들어 덮습니다.
2. **`rem` 을 쓰려면 뿌리 글자크기를 62.5% 로 둬야** 토큰의 숫자가 뜻대로
   동작합니다. 지금 우리 CSS 는 `px` 기준이라 함께 바꿔야 합니다.
3. **서체 파일은 부분집합(subset)** 입니다. 화면에 나오는 한글은 거의 다
   들어 있지만, 아주 드문 한자·기호가 빠질 수 있습니다. 그런 글자가 보이면
   대체 서체(맑은 고딕)로 나옵니다 — 깨지지는 않습니다.
4. **망분리 단일 파일**에서는 서체를 `data:` 로 심어야 합니다. 두 굵기 합쳐
   530KB → base64 약 707KB 가 파일마다 늘어납니다.
5. **배포 라이선스**는 원내 확인이 필요합니다. `package.json` 은 `ISC` 라고
   적혀 있고 KRDS 이용약관을 따르라고 하는데, 서체를 다른 기관에 재배포하는
   것이 되는지는 우리가 판단할 일이 아닙니다.

## 아직 안 쓴 원자료

- `source/krds/scss/component/` 40개 컴포넌트 규격 — 필요할 때 찾아봅니다.
  특히 `_step_indicator.scss`(단계 표시) · `_identifier.scss`(정부 기관 띠) ·
  `_critical_alerts.scss`(중요 경고) 는 이 도구에 바로 쓸 것들입니다.
- 사용자가 준 `KRDS_design_resources.zip` 의 sketch·xd 파일(심볼 104개,
  디자인 스타일 8장)은 저장소에 넣지 않았습니다(15MB). 값은 위 토큰과 같습니다.
