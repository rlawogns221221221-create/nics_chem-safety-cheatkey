# -*- coding: utf-8 -*-
"""결선 발표용 30초 영상의 배경음악 — 긴박한 재난 분위기로 직접 합성합니다

    python3 build/make_short_music.py [나갈파일.wav]     # 기본 .narr/음악30.wav

── 왜 이렇게 만드나 (2026-11-20 사용자 — "나레이션은 빼고, 배경음악은 재난상황에
   걸맞는 긴박한 음악으로 30초") ──
· 결선 발표가 5분이라 4분 36초 시연영상을 틀 수 없어 30초 판을 따로 만듭니다
  (build/make_short_video.mjs). 나레이션이 없으니 음악이 장면 넘김을 이끌어야 합니다.
· 빠르기를 144 BPM 으로 잡았습니다 — 한 박이 0.4167초라 5초가 정확히 12박(3마디)입니다.
  그래서 도구가 바뀌는 10·15·20·25초가 모두 마디 첫 박에 떨어지고, 그 자리에
  큰 북(붐)을 칩니다. 화면과 소리가 같은 순간에 바뀌어야 짧은 영상이 또렷합니다.
· 진행은 Dm → B♭ → C → Dm(도구 01~04). 단조에 16분음 반복음(3-3-2 강세)과
  초침 같은 하이햇을 깔아 "시간이 없다"는 느낌을 줍니다. 처음 2.5초는 경보음 같은
  짧은 삐 소리와 심장 박동 — **실제 사이렌 소리는 쓰지 않습니다**(발표장에서 듣는
  사람이 실제 경보로 착각하면 안 되기 때문).
· 인터넷 음악은 이용허락을 확인해야 해서 쓰지 않고 직접 합성합니다(make_music.py 와
  같은 이유). 난수 씨앗을 고정해 언제 돌려도 같은 소리가 나옵니다.
· 장면 시각은 make_short_video.mjs 의 `장면` 과 맞물려 있습니다 — 한쪽을 바꾸면
  다른 쪽도 함께 바꾸세요.
"""
import pathlib
import sys
import wave

import numpy as np

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".narr" / "음악30.wav"
OUT.parent.mkdir(exist_ok=True)
rng = np.random.default_rng(20261120)

BPM = 144
박 = 60 / BPM            # 0.41667초
길이 = 30.0
N = int(SR * (길이 + 1.0))
L = np.zeros(N)
R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def 넣기(t0, sig, gain=1.0, pan=0.0):
    """t0 초 자리에 소리를 얹음 — pan 은 -1(왼쪽) ~ 1(오른쪽)"""
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i: i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i: i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def 시간(d):
    return np.arange(int(d * SR)) / SR


def 톱니(f, d, 배음=10, 기울기=1.2):
    """배음을 직접 더한 톱니파 — 높은 배음을 줄여 거칠지 않게(필터 없이)"""
    t = 시간(d)
    s = np.zeros_like(t)
    for k in range(1, 배음 + 1):
        if f * k > SR / 2.2:
            break
        s += np.sin(2 * np.pi * f * k * t) / k ** 기울기
    return s


def 낮춤(x, n):
    """이동평균 — 소음을 둥글게(저역만 남김)"""
    return np.convolve(x, np.ones(n) / n, mode="same")


def 킥(d=0.32, f0=115, f1=46):
    t = 시간(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.11) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)


def 붐(d=1.8):
    """장면이 바뀌는 자리의 큰 북 — 낮게 깔리는 울림 + 짧은 바람 소리"""
    t = 시간(d)
    f = 34 + 60 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    낮은 = np.sin(ph) * np.exp(-t / 0.55)
    소음 = 낮춤(rng.standard_normal(len(t)), 18) * np.exp(-t / 0.25) * 2.2
    return 낮은 * 1.1 + 소음


def 탐(f0=190, d=0.4):
    t = 시간(d)
    f = f0 * (0.55 + 0.45 * np.exp(-t / 0.06))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.13) + 0.25 * 낮춤(rng.standard_normal(len(t)), 4) * np.exp(-t / 0.02)


def 틱(d=0.05):
    t = 시간(d)
    n = rng.standard_normal(len(t))
    hp = np.diff(n, prepend=0)          # 높은 소리만 — 초침처럼 가볍게
    return hp * np.exp(-t / 0.012)


def 스네어(d=0.16):
    t = 시간(d)
    return (0.6 * rng.standard_normal(len(t)) * np.exp(-t / 0.045)
            + 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.03))


def 삐(f=1046.5, d=0.11):
    t = 시간(d)
    env = np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.02)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 3 * f * t)) * env


def 뜯기(m, d=0.16, 밝기=10):
    """16분음 반복음 한 개 — 짧게 뜯는 소리"""
    t = 시간(d)
    return 톱니(hz(m), d, 배음=밝기) * np.exp(-t / 0.055) * np.minimum(1, t / 0.002)


def 오르막(d, f0=180, f1=1400):
    """다음 장면으로 끌어올리는 소리 — 소음이 커지고 음이 올라감"""
    t = 시간(d)
    g = (t / d) ** 2.2
    f = f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (0.6 * 낮춤(rng.standard_normal(len(t)), 3) + 0.5 * np.sin(ph)) * g


def 패드(음들, d, 붙임=0.35):
    t = 시간(d)
    s = np.zeros_like(t)
    for m in 음들:
        for 어긋 in (-0.11, 0.0, 0.12):            # 세 줄을 살짝 어긋나게 — 현악기처럼 두껍게
            s += 톱니(hz(m + 어긋), d, 배음=9, 기울기=1.5)
    env = np.minimum(1, t / 붙임) * np.minimum(1, (d - t) / 0.25)
    떨림 = 1 + 0.18 * np.sin(2 * np.pi * 6.0 * t)    # 떨림(트레몰로) — 긴장감
    return s * env * 떨림 / (len(음들) * 3)


# ── 0 ~ 2.5초 : 경보 — 삐 소리 · 심장 박동 · 어긋난 화음이 커짐 ─────────────
for k in range(6):
    넣기(k * 박, 삐(1046.5 if k % 2 == 0 else 880.0), 0.16, pan=-0.4 if k % 2 == 0 else 0.4)
for t0 in (0.0, 0.83, 1.67):
    넣기(t0, 킥(0.25, 90, 40), 0.55)
    넣기(t0 + 0.24, 킥(0.22, 80, 38), 0.38)
불안 = 패드([50, 51, 57], 2.6, 붙임=2.2)          # D3 · E♭3 · A3 — 반음이 부딪는 화음
넣기(0.0, 불안, 0.22)
넣기(1.3, 오르막(1.2, 200, 900), 0.18)

# ── 2.5 ~ 6.67초 : 네 가지 질문 — 질문마다 탐 · 초침 시작 ──────────────────
질문 = [6 * 박, 8 * 박, 10 * 박, 12 * 박]        # 2.50 · 3.33 · 4.17 · 5.00초
for i, t0 in enumerate(질문):
    넣기(t0, 탐(200 - i * 18), 0.9, pan=(-0.3, 0.3, -0.15, 0.15)[i])
    넣기(t0, 붐(0.9), 0.35 + i * 0.08)
for k in range(int(6 * 4), int(70 * 4)):         # 2.5초 ~ 29.2초 16분음 초침
    넣기(k * 박 / 4, 틱(), 0.10 if k % 2 == 0 else 0.055, pan=0.35)
넣기(12 * 박, 패드([38, 50, 53, 57], 6 * 박 + 2 * 박, 붙임=0.8), 0.18)

# ── 반복음(16분음 · 3-3-2 강세) — 5초부터 끝까지, 장면마다 뿌리음이 바뀜 ──────
뿌리 = [(12, 38), (24, 38), (36, 34), (48, 36), (60, 38)]     # (시작 박, 뿌리음) D2 · B♭1 · C2 · D2
강세 = {0, 3, 6}
for 칸 in range(12 * 4, 70 * 4):
    b = 칸 / 4
    r = [m for s, m in 뿌리 if s <= b][-1]
    k = 칸 % 8
    음 = r + (12 if k in 강세 else 0)
    if b >= 60:                                  # 마지막 장면은 한 옥타브 더 얹어 몰아침
        음 += 0 if k in 강세 else 12
    넣기(b * 박, 뜯기(음, 밝기=12 if k in 강세 else 7), 0.20 if k in 강세 else 0.11,
        pan=-0.25 if k % 2 else 0.25)

# ── 6.67 ~ 10초 : 답(서비스 이름) — 화음이 열리고 북이 몰아 올라감 ──────────
넣기(16 * 박, 붐(1.4), 0.6)
for k in range(16, 24):
    넣기(k * 박, 킥(), 0.55)
for k in range(20 * 4, 24 * 4):                 # 8.33초 ~ 10초 스네어 몰아치기(점점 세게)
    g = 0.08 + 0.32 * ((k - 80) / 16) ** 1.6
    넣기(k * 박 / 4, 스네어(), g, pan=0.1)
for k in range(23 * 8, 24 * 8):                 # 마지막 한 박은 32분음
    넣기(k * 박 / 8, 스네어(0.1), 0.36, pan=0.1)
넣기(8.4, 오르막(1.6, 160, 1600), 0.24)

# ── 10 ~ 30초 : 도구 넷 — 장면마다 붐 · 매 박 킥 · 화음 ─────────────────────
화음 = {24: [50, 53, 57, 62], 36: [46, 50, 53, 58], 48: [48, 52, 55, 60], 60: [50, 53, 57, 62]}
for 시작, 음들 in 화음.items():
    넣기(시작 * 박, 붐(), 0.95 if 시작 in (24, 60) else 0.8)
    넣기(시작 * 박, 탐(150), 0.5)
    길이박 = 12 if 시작 < 60 else 10
    넣기(시작 * 박, 패드(음들, 길이박 * 박, 붙임=0.15), 0.26)
    넣기(시작 * 박, 톱니(hz(음들[0] - 24), 길이박 * 박, 배음=6, 기울기=1.6)
        * np.minimum(1, (길이박 * 박 - 시간(길이박 * 박)) / 0.1), 0.22)         # 낮은 베이스
    for k in range(시작, 시작 + 길이박):
        넣기(k * 박, 킥(), 0.62 if (k - 시작) % 4 == 0 else 0.5)
        if (k - 시작) % 2 == 1:
            넣기(k * 박, 스네어(), 0.16, pan=0.12)
    넣기((시작 + 길이박) * 박 - 1.0, 오르막(1.0, 220, 1300), 0.16)      # 다음 장면으로 끌어올림
for k in range(68 * 4, 70 * 4):                 # 끝 직전 스네어 몰아치기
    넣기(k * 박 / 4, 스네어(0.12), 0.2 + 0.2 * (k - 272) / 8, pan=0.1)

# ── 29.17초 : 마지막 큰 북 — 영상이 끝날 때 울림이 잦아듦 ──────────────────
넣기(70 * 박, 붐(1.6), 1.1)
넣기(70 * 박, 탐(120, 0.8), 0.6)
넣기(70 * 박, 패드([38, 50, 57, 62], 0.83, 붙임=0.02), 0.3)

# ── 정리 — 끝 0.35초는 줄이고, 소리 크기를 맞춤(실제 크기 맞춤은 영상에서 loudnorm) ──
끝 = int(길이 * SR)
L, R = L[:끝], R[:끝]
줄 = np.ones(끝)
n = int(0.35 * SR)
줄[-n:] = np.linspace(1, 0, n) ** 1.5
L, R = L * 줄, R * 줄
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.89, R / peak * 0.89
st = np.empty(끝 * 2, np.int16)
st[0::2] = (L * 32767).astype(np.int16)
st[1::2] = (R * 32767).astype(np.int16)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(st.tobytes())
print("만듦", OUT, f"{끝 / SR:.2f}초")
