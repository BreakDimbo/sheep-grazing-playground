import cv2,numpy as np,json,sys
L=open('site/layout.js').read(); L=json.loads(L[L.index('{'):L.rindex('}')+1]); TP=L['treesPx']
ref=cv2.resize(cv2.imread('ref/F0.png'),(2376,1432))
nt=cv2.imread(sys.argv[1]).astype(int); ou=cv2.imread(sys.argv[2]).astype(int)
nt=cv2.resize(nt.astype(np.uint8),(2376,1432)).astype(int); ou=cv2.resize(ou.astype(np.uint8),(2376,1432)).astype(int)
res={}
for i,(x,y,w,k) in enumerate(TP):
    s=int(w*0.9); x0,y0,x1,y1=max(0,x-s),max(0,y-s),min(2376,x+s),min(1432,y+s)
    d=(np.abs(ou-nt).sum(2)>30).astype(np.uint8)[y0:y1,x0:x1]
    d=cv2.morphologyEx(d,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,l,st,_=cv2.connectedComponentsWithStats(d); j=1+np.argmax(st[1:,4]); om=(l==j)
    # ref: grabcut with rect = our bbox expanded
    oy,ox=np.where(om); r=(max(1,ox.min()-25),max(1,oy.min()-25),0,0); r=(r[0],r[1],min(x1-x0-2,ox.max()+25)-r[0],min(y1-y0-2,oy.max()+25)-r[1])
    im=ref[y0:y1,x0:x1].copy(); m=np.zeros(im.shape[:2],np.uint8); bg=np.zeros((1,65)); fg=np.zeros((1,65))
    cv2.grabCut(im,m,r,bg,fg,6,cv2.GC_INIT_WITH_RECT); rm=((m==1)|(m==3)).astype(np.uint8)
    # crown only: colour must be crown-like (reject shadow: keep pixels with L above grass shadow) via hue/sat similar to median of central area
    rm=cv2.morphologyEx(rm,cv2.MORPH_OPEN,np.ones((7,7),np.uint8)); n,l,st,_=cv2.connectedComponentsWithStats(rm); j=1+np.argmax(st[1:,4]); rm=(l==j)
    def bb(m): ys,xs=np.where(m); return xs.min()+x0,ys.min()+y0,xs.max()+x0,ys.max()+y0
    res[i]=dict(ours=bb(om),ref=bb(rm))
    vis=im.copy(); vis[rm]=(vis[rm]*0.5+np.array([255,0,255])*0.5).astype(np.uint8); cv2.drawContours(vis,cv2.findContours(om.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0],-1,(0,0,255),2)
    cv2.imwrite(f'out/X_tf_{i}.png',cv2.resize(vis,(300,300)))
    a,b=res[i]['ours'],res[i]['ref']; print(i,'ours',a,'w',a[2]-a[0],'h',a[3]-a[1],'| ref',b,'w',b[2]-b[0],'h',b[3]-b[1])
