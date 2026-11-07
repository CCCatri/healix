#!/usr/bin/env bash
# WORK_ORDER 2a: the evaluator detects a missing proposal. Runs the demo on the tracked fixture, evaluates the 60 labeled copies,
# then removes one pinned pair from a scratch copy of the export (its label kept) and requires: exactly that pair never proposed,
# the denominator unchanged, every other outcome unchanged. Then an invalid label id must be refused. Exit 1 on any miss.
set -u
F=tests/positive/own_copy; PAIR_A="A#1000"; PAIR_B="B#11000"
npm run -s demo -- tests > /dev/null 2>&1 || { echo "EVALUATOR CHECK FAIL: demo did not run"; exit 1; }
base=$(npm run -s evaluate -- own_copy $F/labels.csv a b $F/tableA.csv $F/tableB.csv 2>&1) || { echo "$base"; echo "EVALUATOR CHECK FAIL: baseline evaluate refused"; exit 1; }
echo "$base" | grep -E 'never proposed|judge|labels'
echo "$base" | grep -q 'never proposed: 0$' && echo "$base" | grep -qE 'judge (right|SUPPORTED): 60$' || { echo "EVALUATOR CHECK FAIL: baseline is not 0 never proposed / 60 confirmed"; exit 1; }
scratch=$(mktemp); awk -F'\t' -v a="$PAIR_A" -v b="$PAIR_B" '!($1 == "own_copy" && $2 == a && $3 == b)' out/demo_pairs.tsv > "$scratch"
removed=$(( $(wc -l < out/demo_pairs.tsv) - $(wc -l < "$scratch") )); [[ $removed == 1 ]] || { echo "EVALUATOR CHECK FAIL: removed $removed lines, expected 1"; exit 1; }
after=$(npm run -s evaluate -- own_copy $F/labels.csv a b $F/tableA.csv $F/tableB.csv "$scratch" 2>&1) || { echo "$after"; echo "EVALUATOR CHECK FAIL: evaluate refused after the removal"; exit 1; }
echo "--- after removing ${PAIR_A} x ${PAIR_B} from a scratch export ---"; echo "$after" | grep -E 'never proposed|judge|labels|1000'
echo "$after" | grep -q 'never proposed: 1$' && echo "$after" | grep -qE 'judge (right|SUPPORTED): 59$' && echo "$after" | grep -qE 'judge (unknown|INSUFFICIENT_EVIDENCE): 0$' && echo "$after" | grep -qE 'judge (refuted|REFUTED): 0$' || { echo "EVALUATOR CHECK FAIL: outcomes after removal are not 1 / 59 / 0 / 0"; exit 1; }
if npm run -s evaluate -- own_copy $F/labels_invalid.csv a b $F/tableA.csv $F/tableB.csv > /dev/null 2>&1; then echo "EVALUATOR CHECK FAIL: invalid label id was not refused"; exit 1; fi
echo "EVALUATOR CHECK PASS: 60 labels; removing ${PAIR_A} x ${PAIR_B} moved exactly one pair to never proposed with the denominator fixed; invalid label refused"
