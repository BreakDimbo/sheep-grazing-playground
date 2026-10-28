import cv2,numpy as np,sys
src=open('compare.py').read().split('regions=dict')[0]
sys.argv=['x','ref/F0.png',sys.argv[1],'x'];exec(src)
for nm,im in [('ref',ref),('ours',bld)]:
    lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB).astype(float); bg=cv2.GaussianBlur(lab,(0,0),5); dl=lab[...,0]-bg[...,0]; b=lab[...,2]-128; a=lab[...,1]-128
    m=((dl>18)&(b>40)&(a>-20)).astype(np.uint8); n,lb,st,ce=cv2.connectedComponentsWithStats(m,8)
    out=[]
    for rn,rm in [('light',light),('bright',bright),('dark',dark),('lime',lime),('wheat',wheat),('path',path)]:
        k=sum(1 for c in ce[1:] if rm[int(c[1]),int(c[0])]); out.append(f'{rn} {k} ({k/rm.sum()*1e4:.1f}/1e4px)')
    print(nm,' | '.join(out))
