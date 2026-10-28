# rt.sh "query" -> render, guard, river crops
n=$RANDOM; DPR=2 timeout 200 python3 shot.py "http://localhost:8765/?clean&freeze&$1" out/t$n.png 1188 716 3 | tail -1
echo "$1 -> t$n"; python3 compare.py ref/F0.png out/t$n.png t | grep -E "^(river|all)"; python3 rz.py out/t$n.png out/rz_$n.jpg; echo out/rz_${n}_0.jpg out/rz_${n}_1.jpg
