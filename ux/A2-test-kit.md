# A2 · Usability test kit

*Phase A, step 2. You run this yourself with 5 people. First on the **current** page (baseline), later with 5 **new** people on the redesigned page.*

**Contents**
1. Who to invite
2. What you need
3. How a session runs (about 30 minutes)
4. Moderator script (read aloud, German and English)
5. Handout: the test offer (fictional)
6. Tasks
7. Comprehension questions with answer key
8. Observation sheet (one per person)
9. SUS questionnaire (German and English)
10. What to send me afterwards

---

## 1. Who to invite

- **5 people per round**, who have **never seen the page**. Use different people for the baseline and for the later round. Otherwise they remember the page, and the comparison is useless.
- **At least 3 of 5 should match Profile A:** own or understand BTC, but have never taken a crypto-backed loan. 1–2 may match Profile B.
- **Mix the devices:** at least 3 on their own phone, the rest on a laptop.
- Not you, not someone who helped build or discuss the page.

## 2. What you need

- **The page:** open `docs/index.html` on the device, or a link once it is published. Before each session, press "Forget my inputs" (in the old version: clear the site data) so everyone starts the same way.
- **The handout** (section 5): printed, or as a picture on a second device. Not on the same screen as the page.
- **A stopwatch** (phone).
- **One observation sheet per person** (section 8), printed or as a copy of this file.
- **Optional, only with permission:** a screen recording. It helps, but notes are enough.

## 3. How a session runs (about 30 minutes)

| Time | What happens |
|---|---|
| 2 min | Welcome, read the script (section 4), ask permission for notes or a recording |
| 15 min | Tasks 1–4 (section 6). The person thinks aloud; you watch and take notes |
| 5 min | Comprehension questions (section 7). Page **closed** for questions 1, 3 and 4 |
| 3 min | SUS questionnaire (section 9) |
| 5 min | Open questions: "What was confusing?" · "What would you remove?" · "Would you use this before taking a loan?" |

**Rules for you as the moderator** (the hardest part):

- **Do not help, explain or defend the page.** If they ask "What does this mean?", answer: "What do you think it means?" Silence is fine.
- **Stuck for more than 2 minutes:** give the smallest possible hint, for example "Maybe scroll down?". Write down that you helped, and at which point.
- **Write down exact words** when they are confused or wrong: "Ah, so BTC falls 55%?" is gold.
- **Note where they look, scroll back or hesitate**, not only what they say.
- **Don't ask "Do you like it?"** Ask what they would do.

## 4. Moderator script (read aloud)

**Deutsch**
> Danke, dass du mitmachst. Ich teste heute eine Webseite, nicht dich. Du kannst nichts falsch machen. Wenn etwas unklar ist, liegt das an der Seite. Bitte sag laut, was du denkst, während du die Seite benutzt: was du suchst, was du erwartest, was dich wundert. Ich werde wenig sagen und dir nicht helfen, weil ich sehen will, wie die Seite ohne Hilfe funktioniert. Darf ich mir Notizen machen? [Optional: Darf ich den Bildschirm aufnehmen? Die Aufnahme sehe nur ich, und ich lösche sie nach der Auswertung.] Die Seite ist kein Finanzrat, und das Angebot ist erfunden.

**English**
> Thanks for taking part. Today I am testing a web page, not you. You can't do anything wrong. If something is unclear, that's the page's fault. Please say out loud what you are thinking while you use it: what you are looking for, what you expect, what surprises you. I will say little and won't help you, because I want to see how the page works without help. May I take notes? [Optional: May I record the screen? Only I will see it, and I will delete it after the analysis.] The page is not financial advice, and the offer is made up.

## 5. Handout: the test offer (fictional)

*Print this, or show it on a second device. It is invented. It does not copy any real lender. It deliberately puts the terms in different places, the way real offers do.*

---

**MUSTERKREDIT – Indicative Term Sheet (FICTIONAL EXAMPLE FOR A USABILITY TEST)**

**1. Facility**
Principal amount: **EUR 15,000.00**. Term: **12 months** from the disbursement date.
A one-off arrangement fee of **1.5 %** of the principal is deducted from the disbursement.

**2. Collateral**
Collateral: Bitcoin (BTC). Loan-to-Value at origination: **50 %**.

**3. Interest**
Nominal interest rate: **11.5 % p.a.**, fixed. Interest accrues monthly and is **capitalised**: it is added to the outstanding amount and bears interest itself. Principal and all interest are payable at maturity.

**4. Collateral monitoring**
The BTC price is the volume-weighted average of three exchanges, measured every minute.
If the LTV reaches **70 %**, the borrower receives a top-up request (margin call) and has **48 hours** to restore the LTV to 50 %.
If the LTV reaches **83 %**, the lender may sell collateral without prior notice.
If the top-up request is not met within 48 hours, the lender may also sell collateral.

**5. Fees on enforcement**
A liquidation fee of **4 %** of the outstanding amount is charged.

**6. Early repayment**
Possible at any time without fee.

---

## 6. Tasks

Give one task at a time, in this order, and read it aloud. Start the stopwatch at task 1 and keep it running.

| # | Task (read aloud) | Done when |
|---|---|---|
| **T1** | *"Imagine you have received this offer and own enough BTC. You want to know whether taking it is a good idea. Use the page to find out."* (Do not say what to enter.) | They state a risk result in their own words. **Note the time** (= time to first answer). |
| **T2** | *"How far can the BTC price fall before your bitcoin is sold?"* | They name a price or a percentage. |
| **T3** | *"Suppose this feels too risky. What could you change to make it safer, and how much safer would it be?"* | They name a change and say how the risk changes. |
| **T4** | *"How much money do you actually get, and how much do you pay back in total?"* | They name both amounts. |

For each task note: **unaided / with a hint / not solved**, time, where they hesitated, exact quotes.

**Expected entries for T1** (for you, do not show): loan 15,000 · starting LTV 50 · margin call 70 · liquidation 83 · 12 months · 11.5% · repayment "everything at the end" with interest on interest · fee 1.5% · liquidation fee 4% of the amount owed · cure period 48 h · "lender sells if not fixed in time". A tester who gets the 5 main numbers right (amount, 50, 83, 12, 11.5) has solved T1, even if some details are missing. **Note which fields they got wrong or skipped.** That tells us which help texts are really needed.

## 7. Comprehension questions with answer key

Ask after the tasks. **For questions 1, 3 and 4, the page is closed** or out of sight, so we test understanding, not reading. Questions 2 and 5 may use the page.

| # | Question (read aloud) | Correct, if the answer contains… | Typical wrong answers to note |
|---|---|---|---|
| **Q1** | *"In your own words: what does the big percentage on the page mean?"* (page closed) | The **share of simulated (possible) future price paths** in which the loan gets **liquidated before it ends**, or "how often, in many simulated futures, I'd lose the collateral". Must mention **liquidation/losing the BTC** and that it is **a model/estimate, not a certainty**. | "BTC will fall by X%" · "the lender keeps X% of my BTC" · "X% interest" · "it will happen for sure" |
| **Q2** | *"At which BTC price would your bitcoin be sold, at the start of the loan?"* (page open) | The page's liquidation price, **≈ 60 % of today's BTC price** (start). Accept anything within 1 %. *(Today's price × 0.5 ÷ 0.83 = × 0.6024; at the end of the loan it rises to ≈ × 0.675 because interest is added.)* | The margin-call price (≈ × 0.714) · today's price × 0.83 |
| **Q3** | *"Name one thing that would make this loan safer."* (page closed) | Any of: **borrow less / lower starting LTV / pledge more BTC** · shorter duration · keep money ready for a margin call · a lender with a higher liquidation LTV · interest paid monthly instead of added | "lower interest rate" (does not change the liquidation risk much) · "wait for BTC to rise" |
| **Q4** | *"What does the page NOT take into account?"* (page closed) | At least one of: **the lender could fail or lose the BTC** · **sudden price jumps or outages** · **the lender measures the price differently** · the future can differ from the past | "nothing" · "fees" (they are included) |
| **Q5** | *"How much do you receive, and what does the loan cost you in total if nothing goes wrong?"* (page open) | Receive **€14,775.00** · pay back **€16,818.89** · total cost **€2,043.89** (interest €1,818.89 + fee €225.00). Effective APR **≈ 13.8 %**. *(Computed with the page's own engine, preset day count.)* | Saying 15,000 is received · only the interest as total cost |

**Scoring:** for each question, **correct / partly / wrong**. "Partly" counts as not correct for the success criteria.

**Not scored, but ask last:** *"Would you take this loan? Why, or why not?"* Write down the answer word for word. It shows whether the page leads to a decision (A1).

## 8. Observation sheet (one per person)

Copy this block for each person.

```
Person #: ___   Date: ________   Round: baseline / redesign
Device: phone / laptop     Browser: ________
Profile: A (first-time) / B (comparer)
BTC knowledge 1–5: ___    Ever had a loan of any kind? yes / no

T1 time to first answer: ___ min ___ s   unaided / hint / not solved
   Fields entered wrong or skipped: _________________________________
   Hesitated at: ____________________________________________________
   Quotes: _________________________________________________________

T2   unaided / hint / not solved   Answer given: ____________________
   Hesitated at / quotes: ___________________________________________

T3   unaided / hint / not solved   Change named: ____________________
   Did they find a way to see the effect? yes / no   Where: _________
   Quotes: _________________________________________________________

T4   unaided / hint / not solved   Amounts given: ___________________
   Quotes: _________________________________________________________

Q1 correct / partly / wrong   Answer: _____________________________
Q2 correct / partly / wrong   Answer: _____________________________
Q3 correct / partly / wrong   Answer: _____________________________
Q4 correct / partly / wrong   Answer: _____________________________
Q5 correct / partly / wrong   Answer: _____________________________
"Would you take this loan?" (word for word): _____________________

Things they never opened or never noticed: ________________________
Things they opened and found useless: ____________________________
"What was confusing?": __________________________________________
"What would you remove?": ________________________________________
Hints you gave (when, what): _____________________________________
SUS answers (1–5 for items 1–10): __ __ __ __ __ __ __ __ __ __
```

## 9. SUS questionnaire (System Usability Scale)

Give it **right after the tasks**, before the open questions. Each statement: **1 = strongly disagree … 5 = strongly agree**. Ask for a quick gut answer and **an answer to every item**.

| # | English (original wording) | Deutsch (Arbeitsübersetzung) |
|---|---|---|
| 1 | I think that I would like to use this system frequently. | Ich denke, dass ich diese Seite gern häufig nutzen würde. |
| 2 | I found the system unnecessarily complex. | Ich fand die Seite unnötig kompliziert. |
| 3 | I thought the system was easy to use. | Ich fand die Seite einfach zu benutzen. |
| 4 | I think that I would need the support of a technical person to be able to use this system. | Ich denke, ich bräuchte die Hilfe einer technisch versierten Person, um diese Seite nutzen zu können. |
| 5 | I found the various functions in this system were well integrated. | Ich fand, die verschiedenen Teile der Seite passen gut zusammen. |
| 6 | I thought there was too much inconsistency in this system. | Ich fand, die Seite ist zu uneinheitlich. |
| 7 | I would imagine that most people would learn to use this system very quickly. | Ich kann mir vorstellen, dass die meisten Menschen sehr schnell lernen, diese Seite zu benutzen. |
| 8 | I found the system very cumbersome to use. | Ich fand die Seite sehr umständlich zu benutzen. |
| 9 | I felt very confident using the system. | Ich habe mich bei der Benutzung der Seite sehr sicher gefühlt. |
| 10 | I needed to learn a lot of things before I could get going with this system. | Ich musste viel lernen, bevor ich mit der Seite zurechtkam. |

*The German column is my working translation. Published, tested German versions exist. If you want scores comparable with other studies, use one of those; for comparing our old and new page, this one is enough, as long as both rounds use the same version.*

**Scoring** (I do this for you if you send me the raw answers):
- Items 1, 3, 5, 7, 9: score − 1.
- Items 2, 4, 6, 8, 10: 5 − score.
- Add everything and multiply by 2.5. The result is 0–100.
- About 68 is the average across many studies. Above 80 is very good.

## 10. What to send me afterwards

For each person: the filled observation sheet (a photo is fine) and the SUS answers. Plus, in a few lines, **your own impression: the 3 moments that went worst.**

I will turn this into:
- the baseline numbers for the success criteria (A4)
- a list of problems, sorted by how many people had them and how badly they got stuck
- the evidence for each keep/cut decision in the content inventory (A3)
