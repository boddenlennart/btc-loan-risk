# Step 5 · Share preview (link preview, title, description)

Status: draft for review (17 Oct 2026).
Files:
- Visual: [sketches/step5-share-preview.html](sketches/step5-share-preview.html)
- Image template: [sketches/og/og-template.html](sketches/og/og-template.html)
- Rendered images: [og-en.png](sketches/og/og-en.png), [og-de.png](sketches/og/og-de.png)

Labels: **O** = observation, **H** = hypothesis, **R** = recommendation.

## 1. The constraint that shapes everything

- **O:** A shared calculation lives after the `#` in the link (`…/#s=…`). By design, that part never leaves the visitor's device. Servers and link-preview robots (X, WhatsApp, Telegram, Google) never see it.
- **O:** So **every link to the page shows the same preview**, also a link to someone's calculation.
- A personal preview ("60 of 100") would need a server that reads the inputs. That breaks the promise "nothing leaves your browser". **R:** don't build it.
- **R:** The personal part travels in the **message text** instead. The page's Share button pre-fills a short summary that the visitor can edit before sending (section 4).

## 2. Title and description

| | English (`/`) | German (`/de/`) |
|---|---|---|
| `<title>` (search) | Bitcoin Loan Check: liquidation risk of any BTC loan (52 characters) | Bitcoin-Kredit-Check: Liquidationsrisiko jedes BTC-Kredits (58) |
| `og:title` (messengers) | Bitcoin Loan Check: an independent check for any Bitcoin loan offer (67) | Bitcoin-Kredit-Check: ein unabhängiger Check für jedes Bitcoin-Kreditangebot (76) |
| description (search and messengers) | See how likely a Bitcoin-backed loan is to be liquidated, at which price BTC is sold, and what it costs. Free, open source, runs in your browser. (145) | Wie wahrscheinlich wird ein Bitcoin-besicherter Kredit liquidiert, bei welchem Kurs wird BTC verkauft, was kostet er? Kostenlos, Open Source, im Browser. (153) |

Limits respected:
- search titles under about 60 characters
- descriptions under about 155 characters
- messenger titles show 1–2 lines

Wording follows positioning C′: neutral, no "safe", no "risky", no lender names, no promises.

## 3. Preview image

- 1200 × 630 px PNG, about 70–90 KB. WhatsApp ignores images that are too large, so the limit is 300 KB.
- One image per language: `og-en.png`, `og-de.png`.
- **Layout:**
  - Everything that matters sits in the **centre 600 px**: logo B and name, the headline, one facts line, and the domain with "Free · Open source".
  - Apps that crop to a square (small WhatsApp previews, some others) keep all of it. The square crop is shown in the visual.
  - The sides carry only the logo idea drawn large: the price dot falling to the sale line.
- **Look:** the page's own identity (paper #f6f5f1, ink, brand #1f4e79, Source Serif 4). No numbers, no red, no "risk" icons.
  - **H:** A number like "60 of 100" in a general preview would look like a claim about all loans.
- **X** shows only the image and the domain, no title, so the image must say what the page is by itself.
- **Production:** the image is rendered from the template by the build step, with the same browser the tests use. The embedded Source Serif 4 replaces the stand-in font. It's rebuilt only when the texts change.

## 4. The Share button and its message text

- **Phone:** the system share sheet (Web Share), with text plus link. **Desktop:** "Copy link and summary".
- The visitor sees and can edit the text before sending. Nothing is sent by the page itself.
- Texts, filled with the visitor's own numbers:

| Case | English | German |
|---|---|---|
| One offer | Loan offer checked: {n} of 100 simulated futures end in liquidation within {months} months. BTC is sold at {price} ({drop}). Full cost {cost}. | Kreditangebot geprüft: In {n} von 100 simulierten Zukünften wird der Kredit innerhalb von {months} Monaten liquidiert. BTC wird bei {price} verkauft ({drop}). Gesamtkosten {cost}. |
| Comparison | Loan offers compared: liquidated within the term, of 100: {list}. | Kreditangebote verglichen: liquidiert innerhalb der Laufzeit, von 100: {list}. |
| Refinancing | Refinancing checked: next {m} months, liquidated of 100: current {a}, refinanced {b}. | Umschuldung geprüft: nächste {m} Monate, liquidiert von 100: bisher {a}, umgeschuldet {b}. |

`{list}` is, for example, "Offer A 60, Offer B 31". Offer names are whatever the visitor typed.

- **Privacy note:** the link already contains the inputs (except notes and the BTC price). The summary adds nothing new. The share sheet makes the act of sharing visible, which is better than silently copying.

## 5. Tags in the page head

```html
<title>Bitcoin Loan Check: liquidation risk of any BTC loan</title>
<meta name="description" content="See how likely a Bitcoin-backed loan is to be liquidated, …">
<link rel="canonical" href="https://bitcoinloancheck.com/">
<link rel="alternate" hreflang="en" href="https://bitcoinloancheck.com/">
<link rel="alternate" hreflang="de" href="https://bitcoinloancheck.com/de/">
<link rel="alternate" hreflang="x-default" href="https://bitcoinloancheck.com/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bitcoin Loan Check">
<meta property="og:title" content="Bitcoin Loan Check: an independent check for any Bitcoin loan offer">
<meta property="og:description" content="See how likely …">
<meta property="og:url" content="https://bitcoinloancheck.com/">
<meta property="og:image" content="https://bitcoinloancheck.com/og-en.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Bitcoin Loan Check: an independent check for any Bitcoin loan offer.">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="de_DE">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121210" media="(prefers-color-scheme: dark)">
```

`/de/` gets the same tags in German, with `og:locale` set to `de_DE` and `og-de.png`.

## 6. A German address: `/de/`

- **O:** Today the language is chosen in the browser after the page loads. Preview robots and Google always see English.
- **R:** The build writes a second copy of the page to `/de/`, which starts in German. It's the same code and data, with German tags and image. The language button switches between `/` and `/de/`.
  - German links and searches then show German previews and results.
  - The cost is one more file of about 2 MB; there's no second code base.
  - Visitors to `/` with a German browser keep the automatic switch as today.

## 7. Icons

- `favicon.svg`: logo B, about 1 KB. It works in light and dark tabs, with a paper background square.
- `apple-touch-icon.png`: 180 × 180, for a home-screen shortcut on phones.
- No web-app manifest for now.

## 8. Checking it at launch

These can only be checked on the live domain; the local test copy and the claude.ai copy have no preview.
- Send the link to yourself in WhatsApp, Signal and Telegram, and post it in an X draft, without publishing.
- If an app shows an old or missing preview: Telegram can refresh it via its official @WebpageBot. Others refresh within a few days.
- The tests check that every tag above exists, the image is 1200 × 630 and under 300 KB, and the texts stay within the length limits.

## 9. What is deliberately not included

- No tracking in links (no `utm_` parameters, no share counters).
- No "share on X / Facebook" buttons with outside scripts. The system share sheet does the job without contacting anyone.
- No per-calculation preview (section 1).
