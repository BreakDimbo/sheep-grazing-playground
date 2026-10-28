import cv2,numpy as np,sys
src=open('compare.py').read().split('regions=dict')[0]
sys.argv=['x','ref/F0.png',sys.argv[1],'x'];exec(src)
fields=(light|bright|dark|lime|wheat)
for nm,im in [('ref',ref),('ours',bld)]:
    lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB).astype(float); bg=cv2.GaussianBlur(lab,(0,0),5); dl=lab[...,0]-bg[...,0]; a=lab[...,1]-128; b=lab[...,2]-128
    out=[]
    for cname,cm in [('Y',(dl>18)&(b>40)&(a>-20)),('W',(dl>18)&(b<25))]:
        m=(cm&fields).astype(np.uint8); n,lb,st,ce=cv2.connectedComponentsWithStats(m,8); ar=st[1:,4]
        out.append(f"{cname} n{n-1} med{np.median(ar) if len(ar) else 0} col{np.median(im[m>0],0)[::-1] if m.sum() else ''}")
    print(nm,' | '.join(out))
