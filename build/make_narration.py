# -*- coding: utf-8 -*-
"""공모전 시연영상 나레이션(여성 음성) 만들기

    python3 build/make_narration.py              # build/영상대본.json → .narr/*.wav · .narr/길이.json

── 왜 이렇게 했나 (2026-11-09 사용자 — "영상에 음악과 여성의 음성이 추가되면") ──
· 음성 합성은 **MeloTTS 한국어(KR)** 를 씁니다 — MIT 라이선스 공개 모델이라
  대회 출품물(홍보에 쓰일 수 있음)에 넣어도 권리 문제가 없습니다. 유료·비공식
  서비스(브라우저 읽어 주기 기능을 몰래 부르는 것 등)는 쓰지 않습니다.
· 모델은 허깅페이스에서 받습니다. 개발 자리는 그 주소로 못 나가므로(CLAUDE.md
  6절) **액션 러너에서만** 돕니다 — "공모전 시연영상 굽기" 가 영상보다 먼저 부릅니다.
· **여성 음성인지 기계로 확인합니다.** 귀로 들어 볼 수 없는 자리라, 목소리의
  기본 주파수(F0) 가운데값을 재어 165Hz 아래(남성 음역)면 멈춥니다.
  (보통 성인 여성 165~255Hz · 남성 85~155Hz)
· 줄마다 따로 만들어 길이를 적어 둡니다 — 녹화 스크립트가 그 길이만큼 화면을
  기다려 말과 장면이 어긋나지 않게 합니다.
"""
import json
import pathlib
import sys
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
대본 = json.loads((ROOT / "build" / "영상대본.json").read_text(encoding="utf-8"))
OUT = ROOT / ".narr"
OUT.mkdir(exist_ok=True)


def 읽기(path):
    try:                                   # MeloTTS 는 soundfile 로 씁니다 — 있으면 그것으로
        import soundfile as sf
        x, sr = sf.read(str(path), dtype="float32", always_2d=False)
        if x.ndim > 1:
            x = x.mean(axis=1)
        return x / np.abs(x).max().clip(1e-9), sr
    except ImportError:
        pass
    with wave.open(str(path), "rb") as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype={2: np.int16, 4: np.int32}[sw]).astype(np.float32)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x / np.abs(x).max().clip(1e-9), sr


def 기본주파수(x, sr):
    """30ms 마디마다 자기상관으로 높낮이를 재고, 소리가 있는 마디의 가운데값."""
    n = int(sr * 0.03)
    f0 = []
    lo, hi = int(sr / 400), int(sr / 70)
    for i in range(0, len(x) - n, n):
        f = x[i:i + n] * np.hanning(n)
        if np.sqrt((f ** 2).mean()) < 0.05:
            continue
        ac = np.correlate(f, f, mode="full")[n - 1:]
        if ac[0] <= 0:
            continue
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.45:
            f0.append(sr / k)
    return float(np.median(f0)) if f0 else 0.0


def main():
    try:
        from melo.api import TTS
    except Exception as e:  # 개발 자리 등 — 영상은 음성 없이도 굽습니다
        sys.exit(f"MeloTTS 를 불러오지 못했습니다: {e}")
    tts = TTS(language="KR", device="cpu")
    spk = tts.hps.data.spk2id["KR"]
    길이, 높이 = {}, []
    for k, 글 in 대본.items():
        if k.startswith("_"):
            continue
        p = OUT / f"{k}.wav"
        # 조금 빠르게(1.08) — 기본 속도는 안내 방송처럼 늘어져 화면보다 말이 늦었습니다
        tts.tts_to_file(글, spk, str(p), speed=1.08, quiet=True)
        x, sr = 읽기(p)
        길이[k] = round(len(x) / sr, 3)
        f = 기본주파수(x, sr)
        높이.append(f)
        print(f"  {k:<10} {길이[k]:5.2f}초 · 높이 {f:5.1f}Hz · {글[:28]}")
    (OUT / "길이.json").write_text(json.dumps(길이, ensure_ascii=False, indent=1), encoding="utf-8")
    가운데 = float(np.median(높이))
    print(f"\n  나레이션 {len(길이)}줄 · 합계 {sum(길이.values()):.1f}초 · 목소리 높이 가운데값 {가운데:.0f}Hz")
    if 가운데 < 165:
        sys.exit("⚠ 목소리 높이가 남성 음역입니다 — 여성 음성으로 바꿔야 합니다")


if __name__ == "__main__":
    main()
