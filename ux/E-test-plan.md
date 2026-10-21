# Step 6 · Test plan

Status: draft for review (17 Oct 2026).
Labels: **O** = observation, **H** = hypothesis, **R** = recommendation.

The thresholds below are set **before** testing and are not changed afterwards. A test that "almost" passes counts as failed. Each failure has a planned response, so a result leads to an action, not a debate.

---

## 0. When, on what, run by whom

| Round | When | Test material | What is tested |
|---|---|---|---|
| **1** | after the redesign is built, before the comparison | a private Cloudflare preview link, plus phone screenshots of the three headline variants | five-second test (A′ / C′ / merge), first-click test, think-aloud tasks 1–4 and 7–9 |
| **2** | after comparison and refinancing are built, before launch | preview link | think-aloud tasks 5–6, and re-tests of anything that failed in round 1 |
| **After launch** | continuously | the live page | privacy-friendly signals (section 5) |

- **Who runs it:** you. No research experience is needed; the scripts below can be read out word for word. A session takes 20–25 minutes, in person or by video call (the tester shares their phone screen).
- **What I prepare** for each round: the preview link, the three screenshots for the five-second test, the scenario cards and an empty results sheet.
- **Data protection:**
  - Testers use the **scenarios on the cards**, never their own loans.
  - Notes are kept without names (P1–P5).
  - No video recordings; written notes only.
  - Notes are deleted after the evaluation.
  - Ask for consent at the start (script below).

---

## 1. Five-second test (positioning)

**Goal:** decide between the three headline variants, and check that no variant comes across as against loans or as a lender's page.

**Material:** the first phone screen (375 × 812) in three versions. Only the headline and subhead differ; the rest is identical.
- **A′:** "How safe are your Bitcoin loan terms?"
- **C′:** "An independent check for any Bitcoin loan offer." (the preferred one)
- **Merge:** A′ headline, C′-style subhead

**Process:** 5 people per variant (15 in total; each person sees **one** variant only).
1. "I'll show you a page for five seconds. Just look at it as you normally would." Show the page for 5 seconds, then hide it.
2. Ask, in this order:
   - "What is this page for?"
   - "Who do you think made it?"
   - "Is this page for or against Bitcoin-backed loans, or neither?"
   - "What, if anything, do you remember about a number?"
   - "Would you look at it more closely? Why or why not?"

**Thresholds per variant, out of 5:**

| Measure | Pass | Planned response if it fails |
|---|---|---|
| States the purpose correctly (checks a Bitcoin loan's risk, liquidation or cost) | **at least 4 of 5** | rewrite the subhead, test again |
| Thinks it's a lender's or a sales page | **at most 1 of 5** | strengthen "independent / no lender" in the subhead and trust line |
| Says "against loans" | **at most 1 of 5**; a variant with 2 or more is dropped | soften the wording, check the red colour and the example number |
| Would look closer | **at least 3 of 5** | review the first screen as a whole |

**Choosing a winner:**
- Among the variants that pass, pick the one with the most correct "purpose" answers. On a tie, pick C′, your preference.
- If no variant passes, rework the first screen before round 2.

---

## 2. First-click test

**Goal:** check that people find their way at the first attempt.

**Process:** the same 5 round-1 think-aloud testers (section 3). Before their tasks, show a screenshot and ask: "Where would you tap first to…?" Note the first tap only.

| # | Question | Correct first tap | Pass |
|---|---|---|---|
| F1 | "You have an offer from a lender. Where do you enter it?" | "Use your own terms" (or the link at the example) | at least 4 of 5 |
| F2 | "You want to check how this number is calculated." | "How to check this number" or "How these numbers are made" | at least 4 of 5 |
| F3 | "You'd like to see a second offer next to this one." | "+ Compare an offer" | at least 4 of 5 |
| F4 | "You'd like to send this to a friend." | "Share" | at least 4 of 5 |
| F5 | (German screenshot) "Sie möchten die Sprache auf Englisch stellen." | the language button | at least 4 of 5 |

If one fails: change the wording or position of that one element, then re-test it in round 2.

---

## 3. Think-aloud sessions (5 people per round)

### Mix of testers (one per profile)

| | Profile | Screening question |
|---|---|---|
| P1 | Skeptical self-custody holder | "Do you keep your BTC in your own wallet?": yes |
| P2 | First-time borrower | "Have you ever taken a loan against BTC?": no, but considering it |
| P3 | German-speaking user | prefers German; runs the session in German |
| P4 | Experienced borrower or numbers person | has had at least one BTC-backed loan, or works with numbers |
| P5 | Friend from a link | starts the session from a shared link on their own phone |

### Script (read aloud)

> "Thank you for helping. I'm testing the page, not you. There are no wrong answers. If something is confusing, that's exactly what I need to know. Please say out loud what you're thinking while you use it. I'll take written notes without your name. No recording. Please use only the example numbers I give you, not your own finances. Is that OK?"

Then give one task card at a time. **Don't help.** If the person is stuck for 60 seconds, say "What would you do now?". After another 60 seconds, mark the task "not completed" and move on.

After each task: "How easy was that, from 1 (very hard) to 7 (very easy)?"

### Tasks and thresholds

| # | Task card (scenario) | Success means | Time limit | Pass |
|---|---|---|---|---|
| T1 | Open the page. "Tell me what this page shows you." | explains the example result in their own words, e.g. "60 of 100 times this loan gets sold" | **30 s** to the first correct statement | at least 4 of 5 |
| T2 | "In your own words: what does '60 of 100' mean?" | understands it as a share of possible futures, **not** "I lose 60%" or "certain" | – | at least 4 of 5 |
| T3 | "An offer: €20,000, starting LTV 40%, sold at 85%, 12 months, 11% interest. How likely is a sale, and at which price?" | states both numbers from the page | **2 min** | at least 4 of 5 |
| T4 | "Find one change that makes this offer safer, and say what it changes." | names a lever and its effect | 1 min | at least 4 of 5 |
| T5 *(round 2)* | "A second offer: same amount, LTV 40%, sold at 90%, 13% interest. Compare both. Which is safer, which is cheaper?" | both answers correct, and says the page doesn't pick a winner | **3 min** | at least 4 of 5 |
| T6 *(round 2)* | "Your loan: you owe €10,000 against 0.28 BTC, 8 months left. A new lender offers €5,000 extra cash for 24 months at 9.5%. Set this up." | the cash-out comparison is visible | **60 s** | at least 4 of 5 |
| T7 | "Would you type your real numbers into this page? Why or why not?" | – (open question) | – | at least 3 of 5 "yes", or "yes, after checking X" |
| T8 | "Send this result to a friend." | the share sheet or link is opened | 30 s | at least 4 of 5 |
| T9 | (P5 only) starts from a shared link: "What did your friend want to show you?" | names the shared result | **10 s** | P5 succeeds |

**Planned responses:**
- T1 or T2 fails: the sentence and dots of the answer are reworked, as it's the core of the page. Re-test in round 2.
- T3 fails: the "Use your own terms" path or the form order is reworked.
- T5 or T6 fails: the comparison table or the "What changes?" question is reworked before launch.
- T7 below threshold: note the reasons word for word. They decide what goes into the trust line.

### Questions after the session
1. "What was the most confusing moment?"
2. "What was missing?"
3. "Was there anything that felt like advertising or advice?" (checks the tone)
4. (P3) "Was anything missing for Germany, for example on taxes?" (checks the one-year rule question from step 3)
5. "Would you send this page to someone? To whom?"

---

## 4. Two extra checks (not with testers)

| Check | How | Pass |
|---|---|---|
| **Automatic translation** | Open the preview link in Chrome and in Safari and use the built-in "translate page" into Spanish and French. Then enter a test offer | the page works, the numbers are unchanged and correctly formatted, nothing breaks. Becomes an automated browser test where possible |
| **Lender fairness review** | Send the preview link to 2–3 lenders and ask: "Is any statement about how loans work factually wrong or unfair?" (your contact, your decision) | no factual error stays unfixed. Opinions are noted, not acted on automatically |

---

## 5. Privacy-friendly signals after launch

No measuring script on the page (decided). These signals come without one:

| Signal | Source | What it tells |
|---|---|---|
| Visits per day and country | Cloudflare dashboard, Analytics → Traffic (approximate, includes bots) | interest overall, and whether a region grows (language decisions) |
| Feedback e-mails | the existing four-question feedback form (pre-filled e-mail) | what confuses, what is missing |
| "Your language is missing?" e-mails | new link in the language menu, same e-mail mechanism | demand for a third language |
| Public questions and bug reports | GitHub issues (linked in the footer) | technical problems, method questions |
| Mentions | search X, Nostr and Stacker News for "bitcoinloancheck" once a month | how people describe the page in their own words (useful for positioning) |

**Thresholds set now:**
- **Third language:** at least 5 independent requests for the same language within 3 months, or Cloudflare traffic from that language region above 15% of visits. Then evaluate translation together with local-currency data.
- **Rework:** the same confusion named by 3 or more people (testers or e-mails) leads to a change, even if each person found it minor.
- **No conclusions from the first 2 weeks of traffic:** they are dominated by bots and launch curiosity.

---

## 6. Finding testers in your audience

**Where:**
- **Local Bitcoin meetups:** in the DACH region, for example the Einundzwanzig community's meetups. In person is easiest for the five-second test (15 people in one evening is realistic).
- **Stacker News and Nostr:** a short post: "Looking for 5 people to test a free, open-source Bitcoin loan check (20 min, video call)."
- **Forums:** the Blocktrainer forum (German), r/BitcoinBeginners (first-time borrowers). Check each forum's rules on research requests first.
- **Your own circle,** for P5 (a friend receiving a link).

**Screening** (a few questions in your message or by e-mail):
- Do you hold BTC?
- Have you ever taken, or considered, a loan against BTC?
- Which language do you prefer?
- Do you mainly use a phone?

Aim for the mix in section 3. **Avoid** people who helped build the page, and lender employees as testers (they belong in the fairness review instead).

**Thank-you:** about 10,000–20,000 sats per session, paid by Lightning. That's private, quick and fits the community. Pay everyone the same, regardless of what they said.

**What you don't collect:** real names in the notes, real loan data, recordings.

---

## 7. Results sheet (copy per round)

| Tester | Profile | Variant (5-s) | Purpose ✓ | Lender/sales? | For/against/neither | F1 | F2 | F3 | F4 | F5 | T1 (s) | T2 | T3 (s) | T4 | T5 | T6 (s) | T7 | T8 | T9 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | | | | | | | | | | | | |
| P2 | | | | | | | | | | | | | | | | | | | | |
| P3 | | | | | | | | | | | | | | | | | | | | |
| P4 | | | | | | | | | | | | | | | | | | | | |
| P5 | | | | | | | | | | | | | | | | | | | | |

After each round, send me the filled-in sheet (without names). I'll mark pass or fail against the thresholds and list the planned changes.
