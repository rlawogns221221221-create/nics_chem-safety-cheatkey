# -*- coding: utf-8 -*-
"""진입 화면 머리띠 — 화학사고(가스 누출) 장면 합성 (2026-11-23 사용자 결정)
    python3 build/make_hero_scene.py 나갈파일 사진(A|B) 누출x 누출y 각도 자르기y 확대 씨앗
· source/ 의 야간 공장 사진(Unsplash) 위에 가스 구름(여러 겹 잡음)과 경광등 빛을 그립니다.
· 실제 사고 사진이 아닙니다 — 배경용 합성 장면입니다.
· 지금 쓰는 다섯 장(그다음 make_site_images.py 를 돌리세요):
    A 1640 700 -62 0.40 1.0 11 / B 1760 640 -55 0.55 1.0 21 / A 1900 620 -72 0.62 1.25 31
    B 1560 700 -48 0.45 1.3 41 / A 1720 760 -66 0.30 1.5 51   → source/photos/hero-1~5.webp
"""
import pathlib
from PIL import Image
import numpy as np, sys
W,H=2400,1250
# 인자: 나갈파일 사진(A|B) 누출x 누출y 각도 자르기y 확대 씨앗
out_path,photo,SX,SY,ANG,CY,ZOOM,SEED=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4]),float(sys.argv[5]),float(sys.argv[6]),float(sys.argv[7]),int(sys.argv[8])
R=str(pathlib.Path(__file__).resolve().parent.parent / 'source') + '/'
src=R+('mos-design-1uvJa08dNfQ-unsplash.jpg' if photo=='A' else 'waa-towaw-qObu9oxpjSs-unsplash.jpg')
im=Image.open(src).convert('RGB'); W0,H0=im.size
cw=int(W0/ZOOM); ch=int(cw*H/W)
if ch>H0: ch=H0; cw=int(ch*W/H)
x=int((W0-cw)*0.5); y=int((H0-ch)*CY); im=im.crop((x,y,x+cw,y+ch)).resize((W,H),Image.LANCZOS)
base=np.asarray(im).astype(np.float32)/255
lum=base.mean(2,keepdims=True)
base=base*0.6+(np.array([0.04,0.07,0.14])*(1-lum)+np.array([1,0.65,0.35])*lum)*0.4
base*=0.7
def noise(sc,seed):
    r=np.random.default_rng(seed); acc=np.zeros((H,W)); tot=0
    for s,w in sc:
        g=r.random((max(2,int(H/s)),max(2,int(W/s))))
        up=np.asarray(Image.fromarray((g*255).astype(np.uint8)).resize((W,H),Image.BICUBIC)).astype(np.float32)/255
        acc+=up*w; tot+=w
    return acc/tot
n1=noise([(300,1),(140,.7),(60,.4),(26,.22),(12,.1)],SEED)
n2=noise([(260,1),(100,.5),(40,.25)],SEED+1)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def plume(sx,sy,ang,spread,length,strength,wob=200):
    dx,dy=np.cos(ang),np.sin(ang)
    u=(xx-sx)*dx+(yy-sy)*dy; v=-(xx-sx)*dy+(yy-sy)*dx
    v=v+(n2-0.5)*wob*np.clip(u/length,0,1.5)
    width=22+np.clip(u,0,None)*spread
    d=np.exp(-(v/width)**2)*np.clip(u/30,0,1)*np.exp(-np.clip(u,0,None)/length)
    return np.clip(d*(0.3+1.25*n1)*strength,0,1)
a=plume(SX,SY,np.deg2rad(ANG),0.55,1300,1.6)+plume(SX+40,SY+10,np.deg2rad(-40),0.45,900,0.9,260)+plume(SX-30,SY,np.deg2rad(-85),0.35,700,0.6)
haze=np.clip((yy/H-0.55)*1.6,0,1)*(0.2+0.6*n2)*0.5
alpha=np.clip(a+haze,0,0.93)[...,None]
warm=np.clip(1-((xx-SX)**2/(650**2)+(yy-(SY+250))**2/(420**2)),0,1)[...,None]
smoke=np.array([0.70,0.72,0.76])*(1-warm)+np.array([1.0,0.66,0.38])*warm
smoke=smoke*(0.5+0.5*n1[...,None])
out=base*(1-alpha)+smoke*alpha
def glow(cx,cy,rx,ry,col,s):
    g=np.clip(1-(((xx-cx)/rx)**2+((yy-cy)/ry)**2),0,1)**2
    return g[...,None]*np.array(col)*s
out+=glow(SX,SY+120,260,170,[1,0.45,0.1],0.55)      # 누출 지점 아래 불빛
out+=glow(2050,1200,620,360,[1,0.12,0.05],0.6)        # 붉은 경광등
out+=glow(1350,1230,480,280,[1,0.55,0.1],0.4)         # 주황 경광등
out+=glow(2330,1150,330,240,[0.2,0.35,1],0.28)        # 파란 경광등
v=np.sqrt(((xx-W/2)/(W*0.75))**2+((yy-H/2)/(H*0.85))**2)
out*=np.clip(1.15-v*0.5,0.5,1)[...,None]
Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8)).save(out_path,quality=92)
