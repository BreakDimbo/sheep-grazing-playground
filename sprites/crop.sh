# crop.sh "params" tag x0 y0 x1 y1 scale : one render, guard lines, and a zoomed ref/ours crop + blink
n=$RANDOM; DPR=2 timeout 200 python3 shot.py "http://localhost:8765/?clean&freeze&$1" out/t$n.png 1188 716 2 | tail -1
echo "$1 -> t$n"; python3 compare.py ref/F0.png out/t$n.png t | grep -E "^(edge|light|river|hedges|trees|all)"; python3 zc.py out/t$n.png $2 $3 $4 $5 $6 $7; echo out/$2_zc.jpg
