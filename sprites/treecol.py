import cv2,numpy as np,json,sys
L=open('site/layout.js').read(); L=json.loads(L[L.index('{'):L.rindex('}')+1]); TP=L['treesPx']; F=L['treesFit']
R=lambda p: cv2.resize(cv2.imread(p),(2376,1432))
ref,nt,ou=R('ref/F0.png'),R(sys.argv[1]).astype(int),R(sys.argv[2])
lin=lambda c:((c/255+0.055)/1.055)**2.4
for i,(x,y,w,k) in enumerate(TP):
    s=int(w*0.9); x0,y0,x1,y1=max(0,x-s),max(0,y-s),min(2376,x+s),min(1432,y+s)
    d=(np.abs(ou.astype(int)-nt).sum(2)>30).astype(np.uint8)[y0:y1,x0:x1]
    n,l,st,_=cv2.connectedComponentsWithStats(cv2.morphologyEx(d,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))); j=1+np.argmax(st[1:,4]); om=(l==j).astype(np.uint8)
    om=cv2.erode(om,np.ones((9,9),np.uint8))>0
    a=ou[y0:y1,x0:x1][om][:,::-1].astype(float); b=ref[y0:y1,x0:x1][om][:,::-1].astype(float)
    # robust: keep pixels where ref is crown-like (not paper): saturation
    hs=cv2.cvtColor(ref[y0:y1,x0:x1],cv2.COLOR_BGR2HSV)[om]; keep=hs[:,1]>60
    a,b=a[keep],b[keep]
    ma,mb=lin(a).mean(0),lin(b).mean(0); g=mb/ma
    la=cv2.cvtColor(ou[y0:y1,x0:x1],cv2.COLOR_BGR2Lab)[om][keep].astype(float).mean(0); lb=cv2.cvtColor(ref[y0:y1,x0:x1],cv2.COLOR_BGR2Lab)[om][keep].astype(float).mean(0)
    # dark tail (creases): 10th pct luminance
    pa=np.percentile(cv2.cvtColor(ou[y0:y1,x0:x1],cv2.COLOR_BGR2Lab)[om][keep][:,0],10); pb=np.percentile(cv2.cvtColor(ref[y0:y1,x0:x1],cv2.COLOR_BGR2Lab)[om][keep][:,0],10)
    print(i,k,'n',keep.sum(),'ratio(lin rgb) %.3f %.3f %.3f'%tuple(g),'Lab ours',la.round(0),'ref',lb.round(0),'L10 %d/%d'%(pa,pb),'cur g',F[i].get('g'))
