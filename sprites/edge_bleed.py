# usage: edge_bleed.py atlas.webp cellsize cols cell [band_px]
# replaces RGB of semi-transparent edge texels with the colour of the nearest opaque interior texels (removes key-colour rims)
import sys,numpy as np,cv2
from PIL import Image
p,cs,cols,cell=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]); band=int(sys.argv[5]) if len(sys.argv)>5 else 6
A=np.array(Image.open(p).convert('RGBA')).astype(np.float32); x=(cell%cols)*cs; y=(cell//cols)*cs
c=A[y:y+cs,x:x+cs]; al=c[...,3]
inner=(al>=250).astype(np.uint8); inner=cv2.erode(inner,np.ones((3,3),np.uint8),iterations=band)
rgb=c[...,:3].copy(); w=inner.astype(np.float32)
num=cv2.GaussianBlur(rgb*w[...,None],(0,0),band*1.5); den=cv2.GaussianBlur(w,(0,0),band*1.5)[...,None]
fill=num/np.maximum(den,1e-4)
edge=(al<250)&(al>0)|((al>=250)&(inner==0))
c[...,:3]=np.where(edge[...,None]&(den>1e-3),fill,rgb)
A[y:y+cs,x:x+cs]=c; Image.fromarray(A.clip(0,255).astype(np.uint8)).save(p,lossless=True)
