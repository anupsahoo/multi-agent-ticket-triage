# The Trust Layer, edition 17
## I Trusted My Agent Judge. It Was Guessing the Whole Time.

60 support replies, each graded by hand (`human_labels.jsonl`). 40 are the tuning set the rubric was written against (32 good, 8 bad). 20 are held out and were never used to write it (15 good, 5 bad). Two judges grade them. The script counts how often each judge agrees with the human, corrects for agreement you would get by luck alone (Cohen's kappa), and reports a bootstrap 95% interval for the held out kappa.

Standard library only. No install, no API key.

```bash
git clone https://github.com/anupsahoo/multi-agent-ticket-triage
cd multi-agent-ticket-triage/editions/tl-17-judge
python3 judge.py   # on Windows: python judge.py
```

Each move in the article also runs on its own: `python3 judge.py --show labels`, `--show luck` or `--show rubric`.

## What you get

| Judge | Replies | Agreement | Luck alone | Kappa | Bad caught |
| --- | --- | --- | --- | --- | --- |
| v1, tone only ("is this a good reply?") | tuning 40 | 80% | 80% | 0.00 | 0 of 8 |
| v2, rubric with a reference answer | tuning 40 | 98% | 66% | 0.93 | 8 of 8 |
| v2, rubric with a reference answer | held out 20 | 85% | 55% | 0.67 | 5 of 5 |

Held out kappa, 95% interval: 0.30 to 1.00. Below the 0.70 bar, and 20 labels are too few to say more.

v1 never fails a polite reply, so it agrees with the human exactly as often as a judge that always says "good". v2 checks two rules: the reply states the fact the policy gives, and promises nothing the policy does not allow. On the replies it was tuned against it looks excellent. On replies it never saw it misses correct answers written in other words ("8am to 8pm", "Settings, then Billing").

The judges are stand ins with fixed rules so every machine gets the same numbers. To test your own judge, replace `judge_v1` with a call to your model and rerun.

## CI floor
`python3 judge.py --check` fails if the numbers above stop coming out of the code (`published.json`).
