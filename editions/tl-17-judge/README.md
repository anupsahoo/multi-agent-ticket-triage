# The Trust Layer, edition 17
## I Trusted My Agent Judge. It Was Guessing the Whole Time.

40 support replies, each graded by hand (`human_labels.jsonl`: 32 good, 8 bad). Two judges grade the same 40. The script counts how often each judge agrees with the human, then corrects for agreement you would get by luck alone (Cohen's kappa).

Standard library only. No install, no API key.

```bash
git clone https://github.com/anupsahoo/multi-agent-ticket-triage
cd multi-agent-ticket-triage/editions/tl-17-judge
python3 judge.py   # on Windows: python judge.py
```

Each move in the article also runs on its own: `python3 judge.py --show labels`, `--show luck` or `--show rubric`.

## What you get

| Judge | Agreement | Luck alone | Kappa |
| --- | --- | --- | --- |
| v1, tone only ("is this a good reply?") | 80% | 80% | 0.00 |
| v2, rubric with a reference answer | 98% | 66% | 0.93 |

v1 never fails a polite reply, so it agrees with the human exactly as often as a judge that always says "good". v2 checks two rules: the reply states the fact the policy gives, and promises nothing the policy does not allow. Its one miss (R25) is a correct answer written in words instead of times, which is the cost of a strict rubric.

The judges are stand ins with fixed rules so every machine gets the same numbers. To test your own judge, replace `judge_v1` with a call to your model and rerun.

## CI floor
`python judge.py --check` fails unless the v2 judge holds kappa 0.7 or above on the human labels.
