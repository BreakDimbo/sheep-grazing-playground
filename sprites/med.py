import sys,numpy as np,cv2
src=open('compare.py').read().split('regions=dict')[0]
sys.argv=['x','ref/F0.png',sys.argv[1],'x',sys.argv[2]]
exec(src)
m=eval(sys.argv[4])
rb=cv2.GaussianBlur(ref,(0,0),3); bb=cv2.GaussianBlur(bld,(0,0),3)
print('ref',np.median(rb[m],0)[::-1],'ours',np.median(bb[m],0)[::-1])
