Gamification usually means points bolted onto boring work. This app tries
something narrower: every mechanism here exists because it changes either
**how much you come back** or **how much you remember** — and several of them
are learning techniques first and game mechanics second.

Below: what the app does, why it should work, and where the line is.

## 1. Rewards you cannot predict

**In the app:** roughly one solve in six turns up an *insight card* — a fact
about SQL you did not ask for — and about one in sixteen pays double XP. You
cannot tell in advance which one it will be.

**Why:** dopamine neurons do not fire for reward itself so much as for
**reward prediction error** — the gap between what you expected and what you
got (Schultz, Dayan & Montague, 1997). A predictable reward stops producing a
response once it is predictable; a variable one keeps producing it. This is
also the engine behind slot machines, which is exactly why the next paragraph
matters.

**The guard rail:** the surprise is small, the payload is knowledge you can
use, and nothing is ever taken away. There is no currency to spend, nothing to
buy, no "streak repair" you have to pay for, and no mechanic designed to keep
you here past the point of usefulness.

## 2. A question before the explanation

**In the app:** many lessons open with **Guess first** — one question asked
before you have read anything, with the answer withheld until the end.

**Why:** two effects stack here. Guessing wrong *before* studying improves
later memory rather than harming it (Richland, Kornell & Kao, 2009; Kornell,
Hays & Bjork, 2009) — an unsuccessful retrieval attempt prepares the ground for
the explanation. And the state of *wanting to know the answer* is itself a
memory enhancer: induced curiosity increases hippocampal activity and improves
retention, including of incidental material learned while curious (Gruber,
Gelman & Ranganath, 2014). Loewenstein's information-gap theory (1994) is the
older framing: curiosity is the felt gap between what you know and what you
want to know, and a question opens one.

## 3. The recall deck

**In the app:** every exercise you solve is scheduled to come back — tomorrow,
then in a few days, then in a couple of weeks — in the **Recall** tab. You have
to write the query from memory again; success pushes it further out, failure
brings it back sooner.

**Why:** this is the highest-value mechanism in the whole app.

- **The testing effect**: retrieving something from memory beats re-reading it,
  by a wide margin, especially at long delays (Roediger & Karpicke, 2006).
- **The spacing effect**: the same total study time distributed across days
  produces far more durable memory than one block (Ebbinghaus, 1885; meta-
  analysed by Cepeda et al., 2006).
- **Desirable difficulties** (Bjork): the version that feels harder while you
  do it — recalling rather than recognising, spaced rather than massed — is
  usually the one that lasts.

It also happens to give the app an honest reason to be worth opening tomorrow,
which is more than most streak systems can say.

## 4. Daily quests, not open-ended effort

**In the app:** three quests a day, drawn from a fixed pool — solve three
exercises, finish a lesson, clear three recall cards. They reset at midnight,
and finishing all three pays a bonus and a streak freeze.

**Why:** goal-setting research is unusually consistent — **specific and
moderately difficult goals beat "do your best"**, provided they are accepted
and feedback is available (Locke & Latham, 1990 and after). "Learn SQL" is not
a goal; "solve three exercises" is. Small and concrete also lowers the
activation energy on a tired evening, which is the moment that actually decides
whether a habit survives.

## 5. Progress you can see moving

**In the app:** a level and XP bar in the header, a per-module progress bar, a
quest map across the top of the dashboard, a daily goal ring.

**Why:** motivation rises as a goal comes into view — the **goal-gradient
effect**, originally Hull (1932), demonstrated in humans by Kivetz, Urminsky &
Zheng (2006), who also showed the **endowed progress effect** with Nunes &
Drèze (2006): a card that starts with two stamps already filled gets completed
more often than an equivalent card starting empty. The **Zeigarnik effect**
(1927) says unfinished business stays active in memory, which is why "2 of 3
exercises done" nags productively. And Amabile & Kramer's diary research (2011)
found that *visible small progress* was the single strongest driver of good
inner work life on a given day.

## 6. Streaks — with a forgiveness token

**In the app:** a day counter, plus **freezes**. Miss a day and a freeze is
spent automatically to keep the streak alive. Finish all three quests in a day
and you earn one back (up to three).

**Why:** streaks work because a growing number becomes something you do not
want to lose — loss aversion (Kahneman & Tversky) pointed at a habit. But the
same force makes a broken streak feel like failure, which triggers the
**"what-the-hell" effect** (Polivy & Herman): one lapse, so the goal is blown,
so why bother at all. The freeze exists to stop a missed Tuesday from ending
the whole project.

## 7. Difficulty aimed at the edge of your ability

**In the app:** the course is ordered so each module sits just past the last,
hints are progressive rather than all-or-nothing, and the feedback on a wrong
answer tells you *which* rows were wrong rather than just "incorrect".

**Why:** learning is fastest not when you always succeed, but at an error rate
around 15% — the "85% rule" (Wilson, Shenhav, Straccia & Cohen, 2019). Too easy
teaches nothing; too hard produces noise instead of a signal. Csikszentmihalyi's
**flow** is the same idea from the subjective side: the absorbing state lives on
the line between boredom and anxiety. If you are getting everything right,
skip ahead; if nothing is landing, drop back a module.

## 8. Why the XP is deliberately unimportant

Extrinsic rewards can *reduce* intrinsic motivation for something you already
enjoy — the **over-justification effect** (Lepper, Greene & Nisbett, 1973),
confirmed by meta-analysis for tangible, expected, contingent rewards (Deci,
Koestner & Ryan, 1999). Get this wrong and the points become the reason you are
here; then the points stop and so do you.

Self-determination theory (Deci & Ryan) predicts what survives: rewards that are
**informational** — feedback about growing competence — support motivation,
while rewards that feel **controlling** undermine it. So in this app XP is a
readout, not a wage: it cannot be spent, it cannot be lost, nothing is gated
behind it, and every lesson is open from the first minute (autonomy). The
intended pull is competence — the feeling of *I can write that query now* —
with the points as a mirror held up to it.

## What this app deliberately does not do

- no XP or progress removed as punishment
- no content locked behind levels, streaks or currency
- no "your streak is about to die" pressure notifications
- no leaderboard against strangers (social comparison motivates a few people
  and demotivates the rest)
- no timers that turn thinking into panic
- no endless feed — the session ends when the day's quests are done

## How to actually use it

1. **Set a cue, not an intention.** "After I make coffee, I do one SQL lesson"
   beats "I should study more" — implementation intentions roughly double
   follow-through (Gollwitzer, 1999).
2. **Keep sessions short and finishable.** Fifteen minutes and three exercises
   beats a heroic two-hour session you do once.
3. **Clear the recall deck before starting new material.** Reviews are the part
   that makes yesterday's work permanent; new lessons are the fun part.
4. **Guess before you read**, even when you are sure you do not know.
5. **Stop while it is still going well.** Ending mid-flow makes the next start
   easier — the same unfinished-business pull the Zeigarnik effect describes.

*References are given as author and year so you can look up the primary
sources; this page is a plain-language summary, not a literature review, and
effect sizes in real life are smaller and noisier than any single study
suggests.*
