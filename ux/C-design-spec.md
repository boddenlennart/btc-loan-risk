# Step 4 · Design critique and spec

Status: draft for review (17 Oct 2026). Visual mock-up: [sketches/step4-mockup.html](sketches/step4-mockup.html).
Labels: **O** = observation (visible in the page or code), **H** = hypothesis (needs testing), **R** = recommendation.
Numbers, method, legal and disclaimer texts do not change. Only order, form and look change.

Decisions already taken (steps 1–3 and follow-ups):
- Layout: Option 1, answer-first report, on phone and desktop.
- Positioning: C′ "An independent check for any Bitcoin loan offer" (A′ and the merge are still tested in step 6).
- Name and domain: **Bitcoin Loan Check** / **Bitcoin-Kredit-Check**, bitcoinloancheck.com. Hosting: Cloudflare Pages.
- New feature: compare 2–3 offers, in two kinds: new offers side by side, and current loan vs. refinancing.
- Tone: never hostile to Bitcoin-backed loans; the message is "your terms decide the risk".

---

## 1. Critique of the current page

| # | Finding | Label |
|---|---|---|
| 1 | The stylesheet uses 15 different font sizes (0.75 to 1.3 rem) and no scale. The page name (18 px) is barely larger than body text. | O |
| 2 | The main number ("60 of 100") is inside a 21 px sentence. Nothing on the page is visually "the answer". | O |
| 3 | The main number is always shown in red (`--critical-ink`), even at 3 of 100. Red reads as "danger", whatever the value. | O |
| 4 | Point 3 works against the goal: the page looks like a warning about loans, not a neutral check of terms. | H |
| 5 | One blue (#2a78d6) is used for primary buttons, selected chips, segmented controls, bars, links and focus. When everything is blue, nothing stands out. | O |
| 6 | Form, answer, "Make it safer" and every section are separate bordered cards with the same weight ("card soup"). Five radii are used (6, 8, 10, 14, 999 px). | O |
| 7 | The look (system font, generic blue, white cards) is the default template look of many calculators, which makes it look interchangeable. | H |
| 8 | The grey "nothing happened" dots have 1.7:1 contrast against the background. They are told apart only by colour. | O |
| 9 | Trust facts (open source, no tracking, data source, test against history) are all at the bottom. | O |
| 10 | Every number is in tables and bars; tabular figures are used in some places, not all. | O |

What already works and stays: plain-language texts, the dot grid (an honest picture of "of 100"), the folded sections, 44 px tap targets, dark mode, the accessibility audit (0 issues).

---

## 2. Visual identity: "an independent report"

**R:** The page should look like a careful, printed research note: paper, ink, one serif for the name, headings and big numbers, and one sober brand colour. Colour is reserved for data.

**H:** This sets the page apart from lender pages, which tend to use dark dashboards, gradients, gauges, "AT RISK" badges and orange or teal accents. A print-like look reads as "independent".

Not used: Bitcoin orange, gradients, gauges or speedometers, glowing effects, stock icons, coins or rockets, emoji.

---

## 3. Typography

**Fonts**
- Headings, the name and big numbers: **Source Serif 4**, semibold (600). Open licence (OFL), self-hosted and embedded in the page, so no font request goes to another server.
  - Subset: Latin plus the characters the page needs (€ $ ä ö ü Ä Ö Ü ß – → × ≈ −).
  - Cost: about 25 KB.
- Body text, labels and inputs: the phone's own system font (`system-ui`). 0 KB, best readability on each device.
- All numbers: `font-variant-numeric: tabular-nums lining-nums`, so digits line up in tables and tiles.

**Type scale.** 7 sizes, roughly a 1.25 ratio, replacing the 15 sizes used today.

| Token | Phone | Desktop | Font, weight / line height | Used for |
|---|---|---|---|---|
| hero | 56 px | 72 px | serif 600 / 1.0 | the one main number ("60") |
| xl | 26 px | 32 px | serif 600 / 1.2 | positioning headline |
| lg | 20 px | 20 px | serif 600 / 1.3 | section titles, "of 100" |
| base | 16 px | 16 px | sans 400 / 1.5 | body text, inputs |
| sm | 14 px | 14–16 px | sans 400 / 1.45 | explanations, table cells |
| xs | 13 px | 13 px | sans 400 / 1.4 | meta lines, legends |
| label | 12 px | 12 px | sans 600, capitals, +0.06 em spacing | tile labels, "EXAMPLE" |

Rules:
- Text never smaller than 12 px; 12 px only for uppercase labels.
- Lines at most 68 characters wide.
- German texts run about 30% longer: no fixed-width labels, tiles wrap.

---

## 4. Colour

**Rules**
1. Ink for text and **for the main number**: no red number. Colour sits only in the dots and the sale-price line.
2. One brand colour (ledger blue) for everything you can press or follow: buttons, links, selected state, focus.
3. Data colours only for outcomes: liquidated (red), partly sold (orange), margin call only (amber), nothing (a hollow ring, so it differs by shape too).
4. "Make it safer" bars are neutral ink-grey, not blue: they are information, not buttons.

**Light mode** (contrast measured against the page background; WCAG AA needs 4.5:1 for text and 3:1 for graphics and field borders)

| Token | Value | Contrast | Use |
|---|---|---|---|
| paper | #f6f5f1 | – | page background |
| surface | #ffffff | – | answer panel, inputs |
| tile | #efede6 | – | key-figure tiles, "best change" |
| rule | #e2dfd6 | decorative | hairlines between sections |
| ink | #15140f | 16.9:1 | text, main number |
| ink-2 | #46443e | 8.9:1 | secondary text |
| muted | #65635c | 5.5:1 (5.1 on tile) | meta lines |
| brand | #1f4e79 | 7.9:1; white on it 8.7:1 | links, buttons, selection, focus |
| liquidated | #b42318 | 6.0:1 | dots, sale line |
| partly sold | #c2410c | 5.2:1 vs surface | dots |
| margin call | #a16207 | 4.5:1 | dots (not for small text on tiles: 4.2:1) |
| ring / field | #8a877e | 3.6:1 vs surface | "nothing happened" rings, input borders |

**Dark mode**

| Token | Value | Contrast |
|---|---|---|
| paper / surface / tile | #121210 / #1b1a17 / #24231f | – |
| ink | #f2f0ea | 16.5:1 |
| ink-2 | #c9c6bd | 11.0:1 |
| muted | #a29f96 | 7.1:1 |
| brand (links) | #9cc0e8 | 9.9:1 |
| brand fill (buttons) | #2c5f8f | white on it 6.7:1 |
| liquidated / partly sold / margin call | #f07167 / #f09a5b / #e0a43a | 6.5 / 7.9 / 8.5:1 |
| ring / field | #77746b | 3.7:1 vs surface |

A test will check every pair above, so a later colour change can't break contrast unnoticed.

---

## 5. Spacing, shape, density

- Spacing steps: 4, 8, 12, 16, 24, 32, 48 px. Nothing in between.
- Two radii only: **6 px** (inputs, buttons, tiles) and **12 px** (the answer panel and the terms panel).
- **One** framed panel per screen: the answer. Sections are separated by hairlines, not cards (report style instead of card soup).
- Phone side padding 16 px; desktop main column at most 720 px of text width.
- Density: the first screen shows exactly one number large. Everything else is at most `lg`.

---

## 6. Layout order

### Phone (375 px wide, first screen 812 px tall)
1. **Top bar** (sticky, 48 px): logo + "Bitcoin Loan Check", language button.
2. **Positioning:** headline (xl), subhead (sm), trust line (xs): "Runs only in your browser · No tracking · Open source ↗".
3. **Answer panel:**
   - the "EXAMPLE" label (or "YOUR OFFER") with "Use your own terms →"
   - the example story (sm)
   - **hero number** + sentence
   - dots + legend
   - the best change
   - three tiles: **Sold at** (price, −% from today), **Full cost** (amount, % a year), **Break-even** (+% BTC by the end)
   - buttons: Use your own terms · + Compare an offer · Share
   - meta line: data period, other method, no trend assumed, **"How to check this number"**
   - one counterparty sentence ("The lender itself can fail or lose your BTC; this is not in the number.")
4. **Your terms** (after the first edit): chips with the key terms and an "Edit" button. Editing opens the form in place.
5. **Make it safer** (open by default): slider and options.
6. Folded sections:
   - What happens when BTC falls
   - What it costs · Borrow or sell?
   - Your loan in every crash since 2014 (the "history" section, renamed for clarity)
   - How these numbers are made
   - What this does not include
   - Help improve this page
7. Footer: licence, not-advice line, Impressum, privacy, donation.

**Fold rule (testable):** at 375 × 812 the name, the headline, the trust line, the hero number and its sentence must be visible without scrolling. The mock-up also fits the dots and tiles above the fold.

### Desktop (from 1024 px)
- Two columns: the report (flexible, max 720 px of text) on the left, a **sticky terms panel** (340 px) on the right.
- The terms panel holds the form; the answer updates when a field is left. Sale price and fall to sale update instantly while typing, because they need no simulation.
- Four tiles: Sold at, Margin call at, Full cost, Break-even.

### Tablet (640–1023 px)
Single column like the phone, with wider tiles.

---

## 7. Before any input: the example result

- **O:** Today the example result is computed after the page opens (about 1.2 s on a Mac, longer on phones).
- **O:** With the starting LTV fixed, the liquidation chance doesn't depend on the BTC price level, because the simulation works with relative moves. Only euro amounts depend on it.
- **R:** Compute the example result when the page is built and embed it. The answer is then visible at once (0 s). When the live price arrives, only the euro amounts update; the main number stays the same.
  - A test checks that the embedded result equals a fresh calculation.
  - The weekly data update refreshes the embedded result.
- **R:** The example is labelled "EXAMPLE" and told as a story ("Borrow €10,000 for 12 months against BTC worth €20,000"). This replaces the yellow "Replace them with your offer" box.

---

## 8. Components

| Component | Spec |
|---|---|
| Hero number | serif 56/72 px, ink colour, "of 100" in lg ink-2 next to it, then the sentence in base |
| Dots | 20 × 5 grid with 4 px gaps. Liquidated, partly sold and margin call filled; nothing = ring. Order: liquidated, partly sold, margin call, nothing |
| Best change | tile background, sm. "One change lowers this: **starting LTV 30% → 22 of 100**." Hidden if no option lowers the number |
| Tiles | tile background, 6 px radius, label (12 px caps), value (serif 17 px), sub-line (xs). 3 per row on phone, 4 on desktop |
| Buttons | primary filled brand (one per screen: "Use your own terms"); secondary outlined; tertiary underlined text. All at least 44 px tall |
| Inputs | 44 px, ring-colour border, unit inside the field; − / + steppers on phone for LTV, duration, rate (steps 1%, 1 month, 0.25%) |
| Segmented choice | brand fill for the selected option, 13 px semibold labels |
| Sections | hairline above, serif lg title, ▸ / ▾ in brand colour, the whole row tappable |
| "?" help | stays at the six agreed places, unchanged |

---

## 9. Comparing offers (new feature)

**Entry:** "+ Compare an offer" in the answer panel. Offer B starts as a **copy** of the current terms; the visitor changes what differs. At most 3 offers (A, B, C). Visitors can rename offers; names stay in their browser.

**Kind 1 · New offers side by side** (mock-up, phone 2)
- A table on top. Rows:
  - liquidated (of 100, within its term)
  - sold at (price and −%)
  - full cost (amount and % a year)
  - you receive
- On desktop, two extra rows: margin call (level and deadline), and result in BTC if buying BTC.
- **No winner** and no "better/worse" colours. One sentence explains: "No offer is marked as better: one can be safer, another cheaper."
- The column you tap becomes the **active offer**. Everything below ("Showing: Offer A") is that offer's full report, so all existing sections keep working.
- All offers use the **same simulated futures**, so differences come only from the terms.
- If the amounts or durations differ, a note says so under the table.

**Kind 2 · Current loan vs. refinancing** (mock-up, phone 3)
- Starts from "A loan I already have". The refinancing offer is pre-filled with today's debt and the same BTC.
- One question, "What changes?":
  - **Same amount** (rollover, or a lender switch for better terms)
  - **Borrow more** (cash-out; one extra field: the amount)
  - **Take back BTC** (one extra field: the BTC released)
- New terms are copied and editable. "Switching costs" are folded, €0 by default: early-repayment fee of the old loan, origination fee of the new one, transfer fees.
- Table rows:
  - liquidated over the **same span** (the current loan's remaining months) for both
  - liquidated over the whole new term (new loan only)
  - sold at
  - you receive now
  - full cost including switching
- Not modelled, explained instead: how the transfer between lenders works and the days the BTC is in transit. Two new entries in "Questions to ask a lender":
  - "How is the old loan paid off, and how long is the BTC in transit?"
  - "Is there a fee for repaying early?"
- Not built: "rolling over forever" (it would depend on an assumed price trend, which the page deliberately avoids).

**Speed:** the extra offers compute only their table numbers (about 0.1–0.3 s each); the full report only for the active offer.

**Share link:** contains all offers; the recipient sees the comparison first.

**Tests to add:**
- identical offers give identical numbers
- an offer differing only in fees differs only in cost
- each table value equals that offer's own full result
- refinancing with "same amount", same terms and no costs equals the current loan over the same span

---

## 10. Trust signals

| Signal | Where |
|---|---|
| "Runs only in your browser · No tracking · Open source ↗" | trust line under the headline |
| "How to check this number" (method, code, test against history, reference results) | meta line under the answer |
| Data period and last update | meta line under the answer |
| Lender failure is not in the number | one sentence under the answer |
| Maker line | **open decision:** named ("Made by Lennart Bodden, independent, no lender affiliation"), pseudonymous, or none. The Impressum names you anyway |
| No affiliate links, no lender names | footer sentence: "No lender pays for or influences this page." |

---

## 11. Logo

Three variants in the mock-up:
- **A · Check on the line:** a check mark resting on a line, meaning "the sale price, checked".
  - Clearest at 16 px.
  - **H:** a check mark can read as "approved / safe", which is misleading on a risk tool.
- **B · Distance to the line:** a dot (the price) above a line (the sale price), with the gap between them, meaning "how far until a sale".
  - The core idea of the page, and less generic.
  - At 16 px it reads as dot over line.
- **C · Ledger rule:** a wordmark with a ruled line ending in a small tick.
  - The most print-like.
  - The small icon needs letters ("LC") and reads worst at 16 px.

**R:** **B**, because it shows what the page measures and promises no safety. A is the fallback if B tests as unclear.

The logo is one colour (brand on paper, or white on brand), used as an inline SVG of about 1 KB, and also serves as the favicon and in the share preview (step 5).

---

## 12. Building it: order of work

1. Tokens, fonts and type scale; replace the 15 sizes; remove the red main number. No layout change yet.
2. Answer-first order:
   - positioning and trust line
   - the answer panel with hero, tiles and the best change
   - the example as a story, embedded and instant
   - the form behind "Use your own terms"
   - desktop terms panel
3. Logo, name and favicon.
4. Comparison, kind 1 (new offers).
5. Comparison, kind 2 (refinancing).

**Tests to add or extend:**
- fold rule at 375 × 812
- every colour pair from section 4
- no red main number
- comparison and refinancing rules (section 9)
- axe audit stays at 0 issues
- the existing 267 tests and browser tests stay green

---

## 13. Open decisions for the owner

1. Logo: B (recommended), A or C?
2. Maker line: named, pseudonym, or none?
3. Serif font: Source Serif 4 (recommended), or system fonts only (0 KB, less distinctive)?
4. Build order as in section 12, comparison after the redesign?
