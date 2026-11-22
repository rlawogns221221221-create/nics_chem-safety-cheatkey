# -*- coding: utf-8 -*-
"""결선 영상 「사고 하나 흐름 판」의 배경음악 — 장면 시각을 받아 합성합니다

    python3 build/make_short_music_flow.py 나갈파일.wav '{"길이":36,"큰북":[4,14,22,26],"작은북":[8,29.6],"끝북":32}'

── 왜 따로 만드나 ──
· 이 판(build/make_short_video_flow.mjs)은 실제 녹화를 엮은 것이라 장면 시각을 그 스크립트가
  정합니다. 시각을 두 곳에 적어 두면 한쪽만 바뀐 날 큰 북과 장면 넘김이 어긋나므로, 시각은
  **인자로 받습니다**(영상 스크립트가 넘김).
· 소리 재료(큰 북 · 종 · 바람 소리 · 반복음)는 줌인 판(make_short_music_zoom.py)과 같습니다 —
  사용자가 "낮고 무겁게 · 큰 북은 그대로" 를 정해 두었습니다(CLAUDE.md 8절). 높은 삐 소리 ·
  하이햇 · 스네어 · 실제 사이렌은 쓰지 않습니다.
· 진행은 E 단조 — 03 Em · 04 C · 01 D · 02 B(끌어 두기) → 마지막 큰 북에서 Em 으로 풀림.
· 120 BPM — 장면 경계가 모두 짝수 초라 마디 첫 박에 떨어집니다.
"""
import json
import pathlib
import sys
import wave

import numpy as np

SR = 44100
OUT = pathlib.Path(sys.argv[1])
판 = json.loads(sys.argv[2])
rng = np.random.default_rng(20261122)

BPM = 120
박 = 60 / BPM
길이 = float(판["길이"])
N = int(SR * (길이 + 1.0))
L = np.zeros(N)
R = np.zeros(N)

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def 넣기(t0, sig, gain=1.0, pan=0.0):
    """t0 초 자리에 소리를 얹음 — pan 은 -1(왼쪽) ~ 1(오른쪽)"""
    i = int(round(t0 * SR))
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


def 킥(d=0.34, f0=110, f1=44):
    t = 시간(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.12) + 0.12 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)


def 붐(d=1.8):
    """장면이 바뀌는 자리의 큰 북 — 첫 판(make_short_music.py)과 같은 소리"""
    t = 시간(d)
    f = 34 + 60 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    낮은 = np.sin(ph) * np.exp(-t / 0.55)
    소음 = 낮춤(rng.standard_normal(len(t)), 18) * np.exp(-t / 0.25) * 2.2
    return 낮은 * 1.1 + 소음


def 탐(f0=150, d=0.4):
    t = 시간(d)
    f = f0 * (0.55 + 0.45 * np.exp(-t / 0.06))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.13) + 0.25 * 낮춤(rng.standard_normal(len(t)), 4) * np.exp(-t / 0.02)


def 무거운탐(d=0.5):
    """마디 셋째 박의 무거운 한 방 — 스네어 대신 낮은 탐 + 둥근 소음"""
    t = 시간(d)
    return 탐(118, d) + 0.55 * 낮춤(rng.standard_normal(len(t)), 9) * np.exp(-t / 0.07)


def 뜯기(m, d=0.24, 밝기=7):
    """8분음 반복음 한 개 — 짧게 뜯는 낮은 소리"""
    t = 시간(d)
    return 톱니(hz(m), d, 배음=밝기) * np.exp(-t / 0.07) * np.minimum(1, t / 0.003)


def 패드(음들, d, 붙임=0.3, 배음=7, 떨빠르기=2.0, 떨깊이=0.07):
    t = 시간(d)
    s = np.zeros_like(t)
    for m in 음들:
        for 어긋 in (-0.1, 0.0, 0.11):           # 세 줄을 살짝 어긋나게 — 현악기처럼 두껍게
            s += 톱니(hz(m + 어긋), d, 배음=배음, 기울기=1.7)
    env = np.minimum(1, t / 붙임) * np.minimum(1, (d - t) / 0.25)
    떨림 = 1 + 떨깊이 * np.sin(2 * np.pi * 떨빠르기 * t)   # 느리고 얕은 떨림
    return s * env * 떨림 / (len(음들) * 3)


def 한방(음들, d=1.3):
    """제목이 뜰 때의 금관 같은 한 방 — 빨리 부풀었다가 낮게 남음(높은 배음은 줄임)"""
    t = 시간(d)
    s = np.zeros_like(t)
    for m in 음들:
        for 어긋 in (-0.06, 0.07):
            s += 톱니(hz(m + 어긋), d, 배음=9, 기울기=1.5)
    env = np.minimum(1, t / 0.025) * (0.35 + 0.65 * np.exp(-t / 0.28)) * np.minimum(1, (d - t) / 0.3)
    return s * env / (len(음들) * 2)


def 종(m, d=1.0):
    """카드가 켜지거나 짚일 때의 낮은 종소리 — 사인 + 어긋난 배음 하나를 짧게"""
    t = 시간(d)
    f = hz(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.38)
         + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.16)
         + 0.12 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.07))
    return s * np.minimum(1, t / 0.004)


def 톡(d=0.14):
    """누를 때의 짧은 '톡' — 높은 딸깍 대신 둥근 낮은 소리"""
    t = 시간(d)
    return 탐(230, d) * 0.8 + 0.3 * 낮춤(rng.standard_normal(len(t)), 5) * np.exp(-t / 0.01)


def 바람(d, 오름=True):
    """카메라가 들어갈 때 차오르는(오름) · 나올 때 내려앉는 낮은 바람 소리.
    어두운 소음과 밝은 소음을 시간에 따라 섞어 음색이 열리거나 닫히게 함(필터 없이)"""
    t = 시간(d)
    x = t / d
    어둠 = 낮춤(rng.standard_normal(len(t)), 40) * 3.2
    밝음 = 낮춤(rng.standard_normal(len(t)), 7) * 1.3
    섞 = x if 오름 else 1 - x
    소음 = 어둠 * (1 - 섞) + 밝음 * 섞
    f = 90 * (5.0 ** x) if 오름 else 450 * (0.2 ** x)
    ph = 2 * np.pi * np.cumsum(f) / SR
    음 = np.sin(ph) * 0.45
    env = x ** 2.2 if 오름 else np.minimum(1, t / 0.04) * np.exp(-t / (d * 0.35))
    return (소음 + 음) * env



큰북 = [float(x) for x in 판["큰북"]]          # 03 · 04 · 01 · 02 장면이 열리는 순간
작은북 = [float(x) for x in 판.get("작은북", [])]
끝북 = float(판["끝북"])
뿌리 = [40, 36, 38, 35]                          # E2 · C2 · D2 · B1
화음 = [[47, 52, 55, 59], [48, 52, 55, 60], [45, 50, 54, 57], [47, 51, 54, 59]]
한방음 = [[52, 59, 64], [48, 55, 60], [50, 57, 62], [47, 54, 59]]
끝화음 = [40, 47, 52, 55, 59]

# ── 여는 장면 — QR 을 비추는 동안 낮게 차오르고, 휴대전화가 열릴 때 종 ──────────
첫 = 큰북[0]
넣기(0.0, 붐(1.6), 0.55)
넣기(0.0, 패드([40, 47, 52], 첫, 붙임=1.4, 떨빠르기=1.5), 0.24)
넣기(0.0, 톱니(hz(28), 첫, 배음=5, 기울기=1.8) * np.minimum(1, 시간(첫) / 1.2), 0.18)
넣기(0.15, 바람(1.0, True), 0.12)               # QR 을 훑는 동안
넣기(1.2, 종(52), 0.32, pan=0.2)                # 첫 화면이 열림
넣기(1.2, 킥(0.28, 90, 40), 0.42)
for t0 in (2.0, 3.0):
    넣기(t0, 킥(), 0.45)

# ── 반복음 — 2초부터 마지막 큰 북까지 8분음 · 3-3-2 강세 · 여덟째 칸만 반음 위 ──────
강세 = {0, 3, 6}
칸 = 4
while 칸 * 0.25 < 끝북 - 0.01:
    t0 = 칸 * 0.25
    k = max([i for i in range(4) if 큰북[i] - 0.001 <= t0] or [0])
    j = 칸 % 8
    m = 뿌리[k] + 1 if j == 7 else 뿌리[k]
    센 = j in 강세
    g = 0.25 if 센 else 0.14
    if t0 < 첫:
        g *= 0.35 + 0.65 * (t0 - 2.0) / (첫 - 2.0)
    넣기(t0, 뜯기(m, 밝기=8 if 센 else 6), g, pan=-0.15 if 칸 % 2 else 0.15)
    칸 += 1

# ── 장면 넷 ─────────────────────────────────────────────────────────
for k, t0 in enumerate(큰북):
    다음 = 큰북[k + 1] if k + 1 < len(큰북) else 끝북
    구간 = 다음 - t0
    넣기(t0, 붐(), 0.95 if k == 0 else 0.85)
    넣기(t0, 탐(140), 0.45)
    넣기(t0, 한방(한방음[k]), 0.32)
    넣기(t0, 패드(화음[k], 구간, 붙임=0.12), 0.27)
    넣기(t0, 톱니(hz(뿌리[k] - 12), 구간, 배음=5, 기울기=1.8)
        * np.minimum(1, (구간 - 시간(구간)) / 0.1), 0.22)
    # 북 — 8분음 0·3·6 칸에 킥, 4 칸에 무거운 탐. 다음 장면 직전 한 박은 몰아치기에 비워 둠
    n8 = int(round((구간 - 박) / 0.25))
    for c in range(1, n8):
        j = c % 8
        if j in (0, 3, 6):
            넣기(t0 + c * 0.25, 킥(), 0.6 if j == 0 else 0.48)
        if j == 4:
            넣기(t0 + c * 0.25, 무거운탐(), 0.34, pan=0.1)
    # 다음 장면으로 — 바람이 차오르고 낮은 탐이 16분음으로 몰아 올라감
    a = 다음 - 박
    넣기(a, 바람(박, True), 0.18)
    for i in range(4):
        넣기(a + i * 0.125, 탐(128 - i * 7, 0.25), 0.16 + 0.07 * i, pan=0.08)

for t0 in 작은북:                                 # 같은 장면 안에서 자막이 바뀌는 자리
    넣기(t0, 붐(0.9), 0.38)
    넣기(t0, 탐(150), 0.32)

# 여는 장면 → 03 으로 들어가는 몰아치기
넣기(첫 - 박, 바람(박, True), 0.18)
for i in range(4):
    넣기(첫 - 박 + i * 0.125, 탐(128 - i * 7, 0.25), 0.18 + 0.08 * i, pan=0.08)

# ── 마지막 큰 북 — Em 으로 풀리며 끝까지 울림 ──────────────────────────────
남 = 길이 - 끝북
넣기(끝북, 붐(2.0), 1.1)
넣기(끝북, 탐(120, 0.8), 0.55)
넣기(끝북, 한방([52, 59, 64]), 0.36)
넣기(끝북, 패드(끝화음, 남, 붙임=0.02, 떨빠르기=1.5), 0.30)
넣기(끝북, 톱니(hz(28), 남, 배음=5, 기울기=1.8) * np.exp(-시간(남) / 1.2), 0.24)

# ── 정리 — 끝 0.45초는 줄이고, 크기를 맞춤(실제 크기 맞춤은 영상에서 loudnorm) ──
끝 = int(길이 * SR)
L, R = L[:끝], R[:끝]
줄 = np.ones(끝)
n = int(0.45 * SR)
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
