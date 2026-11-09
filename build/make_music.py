# -*- coding: utf-8 -*-
"""공모전 시연영상 배경음악 — 직접 합성합니다

    python3 build/make_music.py 길이초 [나갈파일.wav]     # 기본 .narr/음악.wav

── 왜 직접 만드나 (2026-11-09 사용자 — "영상에 음악 … 이 추가되면 더 풍부할 것") ──
· 인터넷에서 받은 음악은 출처·이용허락을 하나하나 확인해야 하고, 대회 영상은
  홍보(언론 배포 포함)에 쓰일 수 있다고 참가신청서가 적고 있습니다. 직접 합성하면
  권리 문제가 처음부터 없습니다.
· 밝고 차분한 진행(C–G–Am–F, 92 BPM)에 부드러운 패드 · 8분음 아르페지오 · 베이스 ·
  아주 옅은 박자를 얹었습니다. 나레이션 밑에 깔리는 소리라 **튀지 않게** 만듭니다
  (실제 크기는 영상에 섞을 때 줄이고, 말할 때 더 낮춥니다 — make_contest_video.mjs).
· 같은 길이를 주면 언제나 같은 소리가 나옵니다(난수 씨앗 고정).
"""
import pathlib
import sys
import wave

import numpy as np

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parent.parent
길이 = float(sys.argv[1]) if len(sys.argv) > 1 else 240.0
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / ".narr" / "음악.wav"
OUT.parent.mkdir(exist_ok=True)
rng = np.random.default_rng(7)

BPM = 92
박 = 60 / BPM
마디 = 박 * 4
N = int(SR * (길이 + 4))
L = np.zeros(N, np.float32)
R = np.zeros(N, np.float32)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# I – V – vi – IV (C · G · Am · F) — 패드 음 / 베이스 뿌리음 / 아르페지오 음
코드 = [
    ([60, 64, 67, 71], 36, [60, 64, 67, 72, 76, 72, 67, 64]),   # Cmaj7
    ([59, 62, 67, 74], 43, [59, 62, 67, 71, 74, 71, 67, 62]),   # G
    ([60, 64, 69, 72], 45, [57, 60, 64, 69, 72, 69, 64, 60]),   # Am
    ([57, 60, 65, 69], 41, [57, 60, 65, 69, 72, 69, 65, 60]),   # Fmaj
]


def 더하기(buf, start, sig):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def 패드(m, dur, detune):
    t = np.arange(int(SR * (dur + 1.2))) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * (1 + detune) * t) + np.sin(2 * np.pi * f * (1 - detune) * t)
         + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t))
    env = np.minimum(1, t / 0.6) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.45))
    vib = 1 + 0.004 * np.sin(2 * np.pi * 0.3 * t)
    return (s * env * vib * 0.05).astype(np.float32)


def 퉁(m, dur=0.6, amp=0.10):
    t = np.arange(int(SR * dur)) / SR
    f = hz(m)
    s = sum(np.sin(2 * np.pi * f * k * t) / (k * k) for k in (1, 3, 5)) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.28)
    return (s * env * amp).astype(np.float32)


def 베이스(m, dur):
    t = np.arange(int(SR * dur)) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    env = (1 - np.exp(-t / 0.01)) * np.exp(-t / 0.9)
    return (s * env * 0.11).astype(np.float32)   # 0.16 은 저음이 앞으로 나와 말소리를 덮었습니다


def 북():
    t = np.arange(int(SR * 0.35)) / SR
    f = 46 + 50 * np.exp(-t / 0.04)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return (s * np.exp(-t / 0.12) * 0.22).astype(np.float32)


def 찰():
    n = int(SR * 0.06)
    x = rng.standard_normal(n)
    x = np.diff(x, prepend=0)                         # 높은 소리만 남김
    return (x * np.exp(-np.arange(n) / (SR * 0.012)) * 0.018).astype(np.float32)


마디수 = int(np.ceil(길이 / 마디))
for b in range(마디수):
    pad, root, arp = 코드[b % 4]
    t0 = b * 마디
    for k, m in enumerate(pad):
        더하기(L, t0, 패드(m, 마디, 0.0016 + 0.0004 * k))
        더하기(R, t0, 패드(m, 마디, 0.0021 - 0.0003 * k))
    if b >= 2:                                      # 둘째 마디부터 베이스
        for q in (0, 2):
            더하기(L, t0 + q * 박, 베이스(root, 박 * 2))
            더하기(R, t0 + q * 박, 베이스(root, 박 * 2))
    if b >= 4:                                      # 넷째 마디부터 아르페지오
        for e, m in enumerate(arp):
            s = 퉁(m + 12 if e % 4 == 2 else m, amp=0.07 if b < 8 else 0.085)
            팬 = 0.35 if e % 2 == 0 else -0.35
            더하기(L, t0 + e * 박 / 2, s * (1 - 팬) / 1.3)
            더하기(R, t0 + e * 박 / 2, s * (1 + 팬) / 1.3)
    if 8 <= b < 마디수 - 2:                          # 여덟째 마디부터 옅은 박자
        for q in (0, 2):
            k = 북()
            더하기(L, t0 + q * 박, k)
            더하기(R, t0 + q * 박, k)
        for e in range(8):
            if e % 2 == 1:
                h = 찰()
                더하기(L, t0 + e * 박 / 2, h * 0.8)
                더하기(R, t0 + e * 박 / 2, h)

# 잔향 — 잦아드는 잡음을 겹쳐 공간감을 줍니다(좌우 다르게)
IR = int(SR * 1.8)
tt = np.arange(IR) / SR


def 잔향(x, seed):
    ir = np.random.default_rng(seed).standard_normal(IR) * np.exp(-tt / 0.45)
    ir[: int(SR * 0.012)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    n = 1 << int(np.ceil(np.log2(len(x) + IR)))
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]
    return y.astype(np.float32)


L = 0.8 * L + 0.32 * 잔향(L, 1)
R = 0.8 * R + 0.32 * 잔향(R, 2)

n = int(SR * 길이)
L, R = L[:n], R[:n]
페이드인, 페이드아웃 = int(SR * 2.0), int(SR * 3.5)
env = np.ones(n, np.float32)
env[:페이드인] = np.linspace(0, 1, 페이드인)
env[-페이드아웃:] = np.linspace(1, 0, 페이드아웃) ** 1.5
L *= env
R *= env
peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
st = (np.stack([L, R], 1) / peak * 0.7 * 32767).astype(np.int16)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(st.tobytes())
print(f"  {OUT.relative_to(ROOT) if OUT.is_relative_to(ROOT) else OUT}  {길이:.1f}초 · {마디수}마디 · {BPM} BPM")
