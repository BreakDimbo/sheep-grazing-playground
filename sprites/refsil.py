import cv2,numpy as np,json,sys
from PIL import Image
L=open('site/layout.js').read(); L=json.loads(L[L.index('{'):L.rindex('}')+1]); TP=L['treesPx']
ref=cv2.resize(cv2.imread('ref/F0.png'),(2376,1432))
vis=[]
for i in map(int,sys.argv[1:]):
    x,y,w,k=TP[i]; s=int(w*0.9); x0,y0=max(0,x-s),max(0,y-s); im=ref[y0:y+s,x0:x+s].copy(); H,W=im.shape[:2]
    m=np.zeros((H,W),np.uint8); r=(int(W*0.15),int(H*0.12),int(W*0.7),int(H*0.76))
    cv2.grabCut(im,m,r,np.zeros((1,65)),np.zeros((1,65)),6,cv2.GC_INIT_WITH_RECT); fg=((m==1)|(m==3))
    lab=cv2.cvtColor(im,cv2.COLOR_BGR2Lab).astype(np.float32); hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    Z=lab[fg]; _,lb,cen=cv2.kmeans(Z,2,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,0.5),5,cv2.KMEANS_PP_CENTERS)
    hi=np.argmax(cen[:,0]); keep=np.zeros((H,W),bool); keep[fg]=(lb.ravel()==hi)
    # crown cluster is brighter; but shaded crown side is dark too: re-admit dark pixels close to crown (within 6px) that are saturated
    km=keep.astype(np.uint8); km=cv2.morphologyEx(km,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15)))
    km=cv2.morphologyEx(km,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    n,l,st,_=cv2.connectedComponentsWithStats(km); j=1+np.argmax(st[1:,4]); km=(l==j).astype(np.uint8)
    r_=max(5,int(0.09*W)); km=(fg&(cv2.dilate(km,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r_+1,2*r_+1)))>0)).astype(np.uint8); km=cv2.morphologyEx(km,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9))); n,l,st,_=cv2.connectedComponentsWithStats(km); j=1+np.argmax(st[1:,4]); km=(l==j).astype(np.uint8)
    # fill holes
    ff=km.copy(); cv2.floodFill(ff,np.zeros((H+2,W+2),np.uint8),(0,0),1); km=km|(1-ff)
    ys,xs=np.where(km); print(i,'ref crown bbox',xs.min()+x0,ys.min()+y0,xs.max()+x0,ys.max()+y0,'w',xs.max()-xs.min(),'h',ys.max()-ys.min())
    c=km[ys.min():ys.max()+1,xs.min():xs.max()+1]*255
    sc=min(900/c.shape[1],860/c.shape[0]); c=cv2.resize(c,(int(c.shape[1]*sc),int(c.shape[0]*sc)))>127
    o=np.zeros((1024,1024,3),np.uint8); o[:]=(255,0,255); xa=512-c.shape[1]//2; ya=900-c.shape[0]; o[ya:900,xa:xa+c.shape[1]][c]=255; o[880:950,504:520]=(40,50,75)
    Image.fromarray(o).save(f'gen/sil_ref{i}.png')
    v=im.copy(); cv2.drawContours(v,cv2.findContours(km,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0],-1,(255,0,255),2); vis.append(cv2.resize(v,(256,256)))
    sx=int(w*0.8); Image.fromarray(cv2.cvtColor(ref[y-sx:y+sx,x-sx:x+sx],cv2.COLOR_BGR2RGB)).resize((512,512)).save(f'gen/style_t{i}.png')
cv2.imwrite('out/X_refsil.png',np.hstack(vis))
