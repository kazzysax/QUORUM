import numpy as np
from PIL import Image, ImageFilter
PAL = {
 "tidewater": ["#04181C","#0B4A50","#1FB5A8","#E9F5F2","#F5A524"],
 "molten":    ["#0B0A0F","#3A1A08","#C2410C","#F5A524","#FDE7C3"],
 "orchard":   ["#0F1220","#3B2F7A","#9D8CFF","#8FF0D0","#F7F7FB"],
 "nocturne":  ["#060608","#1C1C22","#52525B","#A1A1AA","#F4F4F5"],
 "saltlight": ["#0E1A1F","#3B5B66","#C9B79C","#F3EDE4","#FFFFFF"],
 "currents":  ["#050B1A","#14307A","#2F5BEA","#8EC5FF","#F7F7F2"],
}
def hexrgb(h): h=h.lstrip("#"); return np.array([int(h[i:i+2],16) for i in (0,2,4)],float)
def palette(name, t):
    cols=[hexrgb(c) for c in PAL[name]]; n=len(cols)-1
    t=np.clip(t,0,1)*n; i=np.minimum(t.astype(int),n-1); f=(t-i)[...,None]
    c=np.stack(cols)
    return c[i]*(1-f)+c[i+1]*f
def liquid(name, w, h, seed, warp=1.6, freq=2.4, drops=True):
    rng=np.random.default_rng(seed)
    y,x=np.mgrid[0:h,0:w].astype(float); s=max(w,h)
    x/=s; y/=s
    a=rng.uniform(0,6.28,8)
    for k in range(5):
        x2=x+warp*0.12*np.sin(freq*(k+1)*y*3+a[k])
        y2=y+warp*0.12*np.cos(freq*(k+1)*x*3+a[k+1])
        x,y=x2,y2
    v=0.5+0.25*np.sin(x*freq*6+a[6])+0.25*np.sin(y*freq*5+a[7])
    v=v**1.15
    img=palette(name,v)
    # soft light from the top-left
    yy,xx=np.mgrid[0:h,0:w]/s
    light=np.clip(1.15-0.55*np.hypot(xx-0.25*w/s,yy-0.2*h/s),0.55,1.15)[...,None]
    img=img*light
    if drops:
        for _ in range(rng.integers(2,5)):
            cx,cy,r=rng.uniform(0.15,0.85)*w,rng.uniform(0.15,0.85)*h,rng.uniform(0.04,0.11)*s
            d=np.hypot(np.mgrid[0:h,0:w][1]-cx,np.mgrid[0:h,0:w][0]-cy)/r
            m=(d<1)[...,None]
            lens=palette(name,np.clip(1-v+0.15,0,1))*1.05
            img=np.where(m,img*0.35+lens*0.65,img)
            spec=np.exp(-((np.mgrid[0:h,0:w][1]-(cx-0.35*r))**2+(np.mgrid[0:h,0:w][0]-(cy-0.4*r))**2)/(2*(0.18*r)**2))[...,None]
            img=img+spec*200*m
            rim=np.exp(-((d-1)/0.04)**2)[...,None]*60
            img=img+rim
    img=img+rng.normal(0,4,img.shape)  # film grain
    out=Image.fromarray(np.clip(img,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    return out
jobs=[]
names=["tidewater","molten","orchard","nocturne","saltlight","currents"]
for i,n in enumerate(names):
    for j in range(2):
        liquid(n,640,640,seed=i*10+j,warp=1.2+0.5*j,freq=2.0+0.6*j).save(f"art/{n}-{j}.jpg",quality=86)
for i,n in enumerate(["molten","tidewater","orchard"]):
    liquid(n,1400,700,seed=100+i,warp=1.4,freq=1.6,drops=True).save(f"art/banner-{n}.jpg",quality=85)
print("done")
