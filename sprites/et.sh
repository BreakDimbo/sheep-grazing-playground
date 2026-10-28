n=$RANDOM; DPR=2 timeout 200 python3 shot.py "http://localhost:8765/?clean&freeze&$1" out/t$n.png 1188 716 3 | tail -1
echo "$1 -> t$n"; python3 compare.py ref/F0.png out/t$n.png t | grep -E "^(edge|light|all)"; python3 allz.py out/t$n.png t$n >/dev/null; echo out/t${n}_item_3_edge.jpg
