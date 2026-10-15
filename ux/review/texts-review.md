# Plain-language review of all page texts

How to review: read each row. Note the **number** of every text you do not understand, find unclear, too long or wrong, and say briefly why (for example: "112: what is a cure period?"). You don't have to fix the wording; I will. German and English are reviewed together: if one language is unclear, say which.

`{curly}` words are filled in by the page with numbers or dates. `[[word]]` becomes a link to the glossary.

## Page frame and short messages

| # | English | Deutsch | key |
|---|---|---|---|
| 1 | Deutsch | English | `ui.language` |
| 2 | Switch language | Sprache wechseln | `ui.languageSwitch` |
| 3 | How likely is it that a BTC-backed loan gets liquidated, and what does it cost? Free, private, not financial advice. | Wie wahrscheinlich wird ein mit BTC besicherter Kredit liquidiert, und was kostet er? Kostenlos, privat, keine Finanzberatung. | `ui.intro` |
| 4 | Example values. Replace them with your offer. | Beispielwerte. Ersetzen Sie sie durch Ihr Angebot. | `ui.exampleBanner` |
| 5 | Where to find these numbers | Wo Sie diese Zahlen finden | `ui.whereLink` |
| 6 | Close | Schließen | `ui.close` |
| 7 | More | Mehr | `ui.more` |
| 8 | Calculating… ({done} of {total}) | Berechnung läuft… ({done} von {total}) | `ui.computing` |
| 9 | Some inputs need fixing. See the messages in red. | Einige Eingaben müssen korrigiert werden. Siehe die roten Hinweise. | `ui.fixErrors` |
| 10 | The BTC price shown is not current. All results depend on it. Enter today's price. | Der angezeigte BTC-Kurs ist nicht aktuell. Alle Ergebnisse hängen davon ab. Geben Sie den heutigen Kurs ein. | `ui.staleWarning` |
| 11 | Copy link to this calculation | Link zu dieser Berechnung kopieren | `ui.copyLink` |
| 12 | Link copied. It contains your inputs, so share it only with people who may see them. | Link kopiert. Er enthält Ihre Eingaben; teilen Sie ihn nur mit Menschen, die sie sehen dürfen. | `ui.linkCopied` |
| 13 | Reset to example values | Beispielwerte wiederherstellen | `ui.resetExamples` |
| 14 | Forget my inputs | Meine Eingaben löschen | `ui.forgetInputs` |
| 15 | Your inputs were deleted from this browser. | Ihre Eingaben wurden aus diesem Browser gelöscht. | `ui.forgotten` |
| 16 | {n} of 100 | {n} von 100 | `ui.of100` |
| 17 | months | Monate | `ui.months` |
| 18 | month | Monat | `ui.month` |
| 19 | month {n} | Monat {n} | `ui.monthN` |
| 20 | today | heute | `ui.today` |
| 21 | a year | pro Jahr | `ui.perYear` |
| 22 | Show as a table | Als Tabelle anzeigen | `ui.showTable` |
| 23 | Price history in this page: {from} to {to}. | Kurshistorie in dieser Seite: {from} bis {to}. | `ui.dataUntil` |
| 24 | Price data: {from} to {to} · last updated {updated} | Kursdaten: {from} bis {to} · zuletzt aktualisiert am {updated} | `ui.dataThrough` |
| 25 | The price history stored in this page ends on {date}, more than 45 days ago. Results may miss recent price moves. The owner of this page should run the data update. | Die in dieser Seite gespeicherte Kurshistorie endet am {date}, vor mehr als 45 Tagen. Den Ergebnissen fehlen womöglich neuere Kursbewegungen. Der Betreiber dieser Seite sollte die Daten aktualisieren. | `ui.dataOld` |
| 26 | Recent hours added from Bitstamp up to {to}. | Neueste Stunden von Bitstamp ergänzt bis {to}. | `ui.dataAppended` |

## Input form

| # | English | Deutsch | key |
|---|---|---|---|
| 27 | A loan offer | Ein Kreditangebot | `form.modeNew` |
| 28 | A loan I already have | Ein Kredit, den ich schon habe | `form.modeExisting` |
| 29 | More terms from your offer | Weitere Bedingungen aus Ihrem Angebot | `form.moreTerms` |
| 30 | More terms of your loan | Weitere Bedingungen Ihres Kredits | `form.moreTermsExisting` |
| 31 | Expert settings | Experten-Einstellungen | `form.expert` |
| 32 | Add a note about where these numbers come from | Notiz zur Herkunft dieser Zahlen hinzufügen | `form.note` |
| 33 | other | andere | `form.otherDuration` |
| 34 | The rate can change | Der Zins kann sich ändern | `form.rateChanges` |
| 35 | The rate is fixed | Der Zins ist fest | `form.rateFixed` |
| 36 | or enter the BTC you pledge | oder die hinterlegten BTC eingeben | `form.orEnterBtc` |
| 37 | or enter the LTV | oder den LTV eingeben | `form.orEnterLtv` |
| 38 | BTC price used: {price} · {source}, {time} | Verwendeter BTC-Kurs: {price} · {source}, {time} | `form.priceLine` |
| 39 | BTC price used: {price} · entered by you | Verwendeter BTC-Kurs: {price} · von Ihnen eingegeben | `form.priceManual` |
| 40 | BTC price used: {price} · stored in this page on {time}, not current | Verwendeter BTC-Kurs: {price} · in dieser Seite gespeichert am {time}, nicht aktuell | `form.priceStale` |
| 41 | Loading the current BTC price… | Aktueller BTC-Kurs wird geladen… | `form.priceLoading` |
| 42 | change | ändern | `form.priceChange` |
| 43 | load current price | aktuellen Kurs laden | `form.priceReload` |
| 44 | from month | ab Monat | `form.fromMonth` |
| 45 | % a year | % pro Jahr | `form.ratePercent` |
| 46 | Add a rate change | Zinsänderung hinzufügen | `form.addRateStep` |
| 47 | Remove | Entfernen | `form.removeRateStep` |
| 48 | hours | Stunden | `form.hours` |
| 49 | Loan amount | Kreditbetrag | `form.fields.loanAmount.label` |
| 50 | Amount you owe today | Heute geschuldeter Betrag | `form.fields.loanAmount.labelExisting` |
| 51 | Including interest already added to the loan. | Inklusive Zinsen, die bereits zum Kredit addiert wurden. | `form.fields.loanAmount.hintExisting` |
| 52 | Starting LTV | Start-LTV | `form.fields.initialLtv.label` |
| 53 | % | % | `form.fields.initialLtv.unit` |
| 54 | BTC you pledge | BTC, die Sie hinterlegen | `form.fields.collateralBtc.label` |
| 55 | BTC pledged | Hinterlegte BTC | `form.fields.collateralBtc.labelExisting` |
| 56 | Liquidation LTV | Liquidations-LTV | `form.fields.liquidationLtv.label` |
| 57 | % | % | `form.fields.liquidationLtv.unit` |
| 58 | Duration | Laufzeit | `form.fields.durationMonths.label` |
| 59 | Months left | Restlaufzeit | `form.fields.durationMonths.labelExisting` |
| 60 | Interest rate | Zinssatz | `form.fields.rateAnnual.label` |
| 61 | % a year | % pro Jahr | `form.fields.rateAnnual.unit` |
| 62 | What will you do with the money? | Was machen Sie mit dem Geld? | `form.fields.purpose.label` |
| 63 | Spend it | Ausgeben | `form.fields.purpose.spend` |
| 64 | Buy more BTC | Mehr BTC kaufen | `form.fields.purpose.buy` |
| 65 | When do you pay the interest? | Wann zahlen Sie die Zinsen? | `form.fields.repayment.label` |
| 66 | Every month | Jeden Monat | `form.fields.repayment.interestOnly` |
| 67 | Added to the loan, paid at the end | Zum Kredit addiert, am Ende gezahlt | `form.fields.repayment.bullet` |
| 68 | Equal monthly payments | Gleiche Monatsraten | `form.fields.repayment.amortizing` |
| 69 | Does added interest also earn interest? | Kosten addierte Zinsen selbst wieder Zinsen? | `form.fields.compounding.label` |
| 70 | No | Nein | `form.fields.compounding.none` |
| 71 | Yes, monthly | Ja, monatlich | `form.fields.compounding.monthly` |
| 72 | Origination fee | Abschlussgebühr | `form.fields.originationFee.label` |
| 73 | % of the loan | % des Kredits | `form.fields.originationFee.percent` |
| 74 | fixed amount | fester Betrag | `form.fields.originationFee.fixed` |
| 75 | What happens when BTC falls? | Was passiert, wenn BTC fällt? | `form.fields.marginCall.label` |
| 76 | Margin call at | Margin Call bei | `form.fields.marginCallLtv.label` |
| 77 | Leave empty if your offer has no margin call. | Leer lassen, wenn Ihr Angebot keinen Margin Call hat. | `form.fields.marginCallLtv.hint` |
| 78 | At the margin call | Beim Margin Call | `form.fields.marginCallConsequence.label` |
| 79 | Only a warning | Nur eine Warnung | `form.fields.marginCallConsequence.warningOnly` |
| 80 | Top up in time, otherwise the lender sells everything | Rechtzeitig nachschießen, sonst verkauft der Kreditgeber alles | `form.fields.marginCallConsequence.liquidateAfterCure` |
| 81 | Top up in time, otherwise the lender sells only enough | Rechtzeitig nachschießen, sonst verkauft der Kreditgeber nur so viel wie nötig | `form.fields.marginCallConsequence.partialAfterCure` |
| 82 | The lender sells part of the BTC at once | Der Kreditgeber verkauft sofort einen Teil der BTC | `form.fields.marginCallConsequence.autoPartial` |
| 83 | Time to top up | Zeit zum Nachschießen | `form.fields.curePeriodHours.label` |
| 84 | At the liquidation LTV the lender sells | Beim Liquidations-LTV verkauft der Kreditgeber | `form.fields.liquidationSale.label` |
| 85 | everything | alles | `form.fields.liquidationSale.all` |
| 86 | only enough | nur so viel wie nötig | `form.fields.liquidationSale.partial` |
| 87 | LTV the lender brings you back to | LTV, auf den der Kreditgeber Sie zurückbringt | `form.fields.cureTargetLtv.label` |
| 88 | Empty means your starting LTV. | Leer heißt: Ihr Start-LTV. | `form.fields.cureTargetLtv.hint` |
| 89 | Liquidation fee | Liquidationsgebühr | `form.fields.liquidationFee.label` |
| 90 | % of the amount owed | % des geschuldeten Betrags | `form.fields.liquidationFee.debt` |
| 91 | % of the BTC sold | % der verkauften BTC | `form.fields.liquidationFee.collateralSold` |
| 92 | How will you repay? | Wie zahlen Sie zurück? | `form.fields.repayWith.label` |
| 93 | By selling BTC at the end | Durch BTC-Verkauf am Ende | `form.fields.repayWith.sell` |
| 94 | With new money | Mit neuem Geld | `form.fields.repayWith.cash` |
| 95 | Currency | Währung | `form.fields.currency.label` |
| 96 | Start date | Startdatum | `form.fields.startDate.label` |
| 97 | Only matters if interest is counted by actual days. | Nur wichtig, wenn Zinsen nach tatsächlichen Tagen berechnet werden. | `form.fields.startDate.hint` |
| 98 | How days are counted | Wie Tage gezählt werden | `form.fields.dayCount.label` |
| 99 | Yearly rate ÷ 12 each month | Jahreszins ÷ 12 pro Monat | `form.fields.dayCount.30/360` |
| 100 | Actual days ÷ 365 | Tatsächliche Tage ÷ 365 | `form.fields.dayCount.act/365` |
| 101 | Actual days ÷ 360 | Tatsächliche Tage ÷ 360 | `form.fields.dayCount.act/360` |
| 102 | 2,000 (fast) | 2.000 (schnell) | `form.fields.simPaths.2000` |
| 103 | 10,000 | 10.000 | `form.fields.simPaths.10000` |
| 104 | 20,000 (slow on phones) | 20.000 (langsam auf Handys) | `form.fields.simPaths.20000` |
| 105 | Simulated futures | Simulierte Zukünfte | `form.fields.simPaths.label` |
| 106 | Length of copied price stretches (days) | Länge der kopierten Kursabschnitte (Tage) | `form.fields.bootstrapBlockDays.label` |
| 107 | Note | Notiz | `form.fields.notes.label` |
| 108 | LTV = loan ÷ value of the BTC you pledge. A lower LTV means more BTC behind the same loan, so the price can fall further. Example: loan €10,000 at 50% LTV means you pledge BTC worth €20,000. At a BTC price of €50,000 that is 0.4 BTC. | LTV = Kredit ÷ Wert der hinterlegten BTC. Ein niedrigerer LTV heißt: mehr BTC hinter demselben Kredit, der Kurs kann also tiefer fallen. Beispiel: Kredit 10.000 € bei 50 % LTV heißt, Sie hinterlegen BTC im Wert von 20.000 €. Bei einem BTC-Kurs von 50.000 € sind das 0,4 BTC. | `form.help.initialLtv` |
| 109 | When BTC falls, your loan stays the same but your BTC is worth less, so the LTV rises. At this LTV the lender sells your BTC. A higher number gives you more room. Example: €10,000 loan, 0.4 BTC, liquidation at 80%: the sale happens when 0.4 BTC is worth €12,500, which is a BTC price of €31,250. | Fällt BTC, bleibt Ihr Kredit gleich, aber Ihre BTC sind weniger wert; der LTV steigt. Bei diesem LTV verkauft der Kreditgeber Ihre BTC. Eine höhere Zahl gibt Ihnen mehr Spielraum. Beispiel: 10.000 € Kredit, 0,4 BTC, Liquidation bei 80 %: Verkauft wird, wenn 0,4 BTC nur noch 12.500 € wert sind, also bei einem BTC-Kurs von 31.250 €. | `form.help.liquidationLtv` |
| 110 | If interest is added to the loan, what you owe grows every month, and so does the price at which your BTC is sold. Example: €10,000 at 10% for a year. Paid monthly, you owe €10,000 all year. Added to the loan, you owe about €11,000 at the end, and the sale price rises by about 10%. | Werden Zinsen zum Kredit addiert, wächst Ihre Schuld jeden Monat, und damit auch der Kurs, bei dem Ihre BTC verkauft werden. Beispiel: 10.000 € zu 10 % für ein Jahr. Monatlich gezahlt, schulden Sie das ganze Jahr 10.000 €. Zum Kredit addiert, schulden Sie am Ende etwa 11.000 €, und der Verkaufskurs steigt um etwa 10 %. | `form.help.repayment` |
| 111 | A [[marginCall]] comes before a sale: your LTV has risen to a warning level. What happens next depends on your lender. It may be only a warning. You may have some hours to add BTC or repay part, or the lender sells everything or just enough. Or the lender sells part of your BTC at once. Example: margin call at 70% with a 48-hour deadline: if the LTV is still 70% after 48 hours, the lender sells. | Ein [[marginCall]] kommt vor einem Verkauf: Ihr LTV ist auf eine Warnstufe gestiegen. Was dann passiert, hängt vom Kreditgeber ab. Es kann nur eine Warnung sein. Sie haben vielleicht einige Stunden, um BTC nachzuschießen oder einen Teil zurückzuzahlen, sonst verkauft der Kreditgeber alles oder so viel wie nötig. Oder der Kreditgeber verkauft sofort einen Teil Ihrer BTC. Beispiel: Margin Call bei 70 % mit 48 Stunden Frist: Liegt der LTV nach 48 Stunden noch bei 70 %, verkauft der Kreditgeber. | `form.help.marginCall` |

## "Where to find these numbers"

| # | English | Deutsch | key |
|---|---|---|---|
| 112 | Where to find these numbers | Wo Sie diese Zahlen finden | `where.title` |
| 113 | Your offer or loan agreement contains five numbers this page needs. Look for these words: | Ihr Angebot oder Kreditvertrag enthält fünf Zahlen, die diese Seite braucht. Suchen Sie nach diesen Wörtern: | `where.intro` |
| 114 | Loan amount | Kreditbetrag | `where.items.0.field` |
| 115 | "principal", "loan amount", "Darlehensbetrag" | "Darlehensbetrag", "Kreditbetrag", "principal", "loan amount" | `where.items.0.words` |
| 116 | Starting LTV | Start-LTV | `where.items.1.field` |
| 117 | "LTV", "loan-to-value", "Beleihungsquote". If only the collateral amount is given: loan ÷ collateral value | "LTV", "Beleihungsquote", "Loan-to-Value". Steht nur die Sicherheitsmenge da: Kredit ÷ Wert der Sicherheit | `where.items.1.words` |
| 118 | Liquidation LTV | Liquidations-LTV | `where.items.2.field` |
| 119 | "liquidation", "Verwertung", the section on selling or enforcing the collateral | "Liquidation", "Verwertung", der Abschnitt zum Verkauf oder zur Verwertung der Sicherheit | `where.items.2.words` |
| 120 | Duration | Laufzeit | `where.items.3.field` |
| 121 | "term", "maturity", "Laufzeit" | "Laufzeit", "Fälligkeit", "term", "maturity" | `where.items.3.words` |
| 122 | Interest rate | Zinssatz | `where.items.4.field` |
| 123 | "nominal rate", "interest rate", "Sollzins". Not the APR: the page calculates that itself | "Sollzins", "Nominalzins", "Zinssatz", "interest rate". Nicht den Effektivzins: den berechnet die Seite selbst | `where.items.4.words` |
| 124 | The other terms are in sections called "fees", "collateral monitoring" or "margin call". The page fills them with starting values you can change under "More terms from your offer". | Die übrigen Bedingungen stehen in Abschnitten wie "Gebühren", "Überwachung der Sicherheit" oder "Margin Call". Die Seite füllt sie mit Startwerten, die Sie unter "Weitere Bedingungen aus Ihrem Angebot" ändern können. | `where.others` |
| 125 | Principal amount: EUR 15,000.00 · Term: 12 months · Loan-to-Value at origination: 50 % · Nominal interest rate: 11.5 % p.a. · If the LTV reaches 83 %, the lender may sell collateral. | Darlehensbetrag: EUR 15.000,00 · Laufzeit: 12 Monate · Beleihungsquote bei Auszahlung: 50 % · Sollzins: 11,5 % p. a. · Erreicht die Beleihungsquote 83 %, darf der Kreditgeber die Sicherheit verwerten. | `where.sample` |

## Answer, "Make it safer", price outlook

| # | English | Deutsch | key |
|---|---|---|---|
| 126 | Your result | Ihr Ergebnis | `results.title` |
| 127 | In {n} of 100 simulated futures, this loan is liquidated within {months} months. | In {n} von 100 simulierten Zukünften wird dieser Kredit innerhalb von {months} Monaten liquidiert. | `results.headlineLiq` |
| 128 | In {n} of 100 simulated futures, this loan is liquidated in the {months} months left. | In {n} von 100 simulierten Zukünften wird dieser Kredit in den verbleibenden {months} Monaten liquidiert. | `results.headlineLiqExisting` |
| 129 | In {n} of 100 simulated futures, the lender sells all your BTC to close the loan, and in {m} more it sells part of it, within {months} months. | In {n} von 100 simulierten Zukünften verkauft der Kreditgeber alle Ihre BTC, um den Kredit zu schließen, und in {m} weiteren einen Teil davon, innerhalb von {months} Monaten. | `results.headlinePartial` |
| 130 | A simulated future is one possible path of the BTC price over your loan, built from real price moves since 2014. The page calculates 10,000 of them and counts what the lender would do in each. Example: 64 of 100 means that in 64 of every 100 paths, your BTC was sold before the loan ended. It is not a forecast and not a promise. | Eine simulierte Zukunft ist ein möglicher Verlauf des BTC-Kurses während Ihres Kredits, gebaut aus echten Kursbewegungen seit 2014. Die Seite berechnet 10.000 davon und zählt, was der Kreditgeber in jeder tun würde. Beispiel: 64 von 100 heißt, in 64 von je 100 Verläufen wurden Ihre BTC vor Laufzeitende verkauft. Das ist keine Prognose und kein Versprechen. | `results.headlineHelp` |
| 131 | liquidated | liquidiert | `results.legendLiquidated` |
| 132 | part of the BTC sold | Teil der BTC verkauft | `results.legendPartial` |
| 133 | margin call, nothing sold | Margin Call, nichts verkauft | `results.legendMargin` |
| 134 | nothing happened | nichts passiert | `results.legendNothing` |
| 135 | Your BTC is sold if the price falls {drop}, to {price}. | Ihre BTC werden verkauft, wenn der Kurs um {drop} auf {price} fällt. | `results.saleLine` |
| 136 | Your BTC is sold if the price falls {drop}, to {price}, or earlier if a margin call at {mcPrice} is not fixed within {hours} hours. | Ihre BTC werden verkauft, wenn der Kurs um {drop} auf {price} fällt, oder früher, wenn ein Margin Call bei {mcPrice} nicht innerhalb von {hours} Stunden behoben wird. | `results.saleLineCure` |
| 137 | At {mcPrice} (−{mcDrop}) the lender already sells part of your BTC. Everything is sold at {price} (−{drop}). | Bei {mcPrice} (−{mcDrop}) verkauft der Kreditgeber bereits einen Teil Ihrer BTC. Alles wird bei {price} (−{drop}) verkauft. | `results.saleLineAuto` |
| 138 | At {mcPrice} (−{mcDrop}) the lender sells part of your BTC, and again at {price} (−{drop}). | Bei {mcPrice} (−{mcDrop}) verkauft der Kreditgeber einen Teil Ihrer BTC, und bei {price} (−{drop}) noch einmal. | `results.saleLineAutoPartialLiq` |
| 139 | At {price} (−{drop}) the lender sells part of your BTC to bring the LTV back down. | Bei {price} (−{drop}) verkauft der Kreditgeber einen Teil Ihrer BTC, um den LTV wieder zu senken. | `results.saleLinePartialLiq` |
| 140 | Where BTC was sold, you keep about {kept} of it (middle value). | Wo BTC verkauft wurden, behalten Sie etwa {kept} davon (mittlerer Wert). | `results.kept` |
| 141 | Because interest is added, this price rises to {end} by the end. | Weil Zinsen addiert werden, steigt dieser Kurs bis zum Ende auf {end}. | `results.rising` |
| 142 | With your price outlook ({trend} a year): {n} of 100. | Mit Ihrem Kursausblick ({trend} pro Jahr): {n} von 100. | `results.outlookLine` |
| 143 | Based on real BTC price moves since 2014 · other method: {g} of 100 · no price trend assumed · not a forecast | Auf Basis echter BTC-Kursbewegungen seit 2014 · andere Methode: {g} von 100 · ohne Kurstrend gerechnet · keine Prognose | `results.basis` |
| 144 | How these numbers are made | Wie diese Zahlen entstehen | `results.howMade` |
| 145 | What this does not include | Was das nicht abbildet | `results.limitsTitle` |
| 146 | The future can be wilder than the past. Every model can be wrong. | Die Zukunft kann wilder sein als die Vergangenheit. Jedes Modell kann falsch liegen. | `results.limits.0` |
| 147 | The lender itself could fail, freeze withdrawals or lose your BTC. | Der Kreditgeber selbst kann pleitegehen, Auszahlungen stoppen oder Ihre BTC verlieren. | `results.limits.1` |
| 148 | Prices can jump past the sale price, for example during an exchange outage. You may then get back less. | Kurse können über den Verkaufskurs hinweg springen, etwa bei einem Börsenausfall. Dann bekommen Sie womöglich weniger zurück. | `results.limits.2` |
| 149 | Your lender may measure the BTC price differently from this page. | Ihr Kreditgeber misst den BTC-Kurs womöglich anders als diese Seite. | `results.limits.3` |
| 150 | Make it safer | Sicherer machen | `results.safer` |
| 151 | Starting LTV {ltv} → {p} of 100 liquidated · you pledge {btc} | Start-LTV {ltv} → {p} von 100 liquidiert · Sie hinterlegen {btc} | `results.sliderLine` |
| 152 | LTV {ltv} → {p} of 100 liquidated · {btc} pledged (add {add}) | LTV {ltv} → {p} von 100 liquidiert · {btc} hinterlegt ({add} nachschießen) | `results.sliderLineExisting` |
| 153 | LTV {ltv} → {p} of 100 liquidated · {btc} pledged | LTV {ltv} → {p} von 100 liquidiert · {btc} hinterlegt | `results.sliderLineExistingNow` |
| 154 | Drag to try a lower LTV: borrow less, or pledge more BTC. Release to use it. | Ziehen Sie, um einen niedrigeren LTV zu testen: weniger leihen oder mehr BTC hinterlegen. Loslassen übernimmt den Wert. | `results.sliderNote` |
| 155 | Other options, one change at a time (liquidated, of 100): | Weitere Möglichkeiten, jeweils eine Änderung (liquidiert, von 100): | `results.otherOptions` |
| 156 | Your terms as they are | Ihre Bedingungen, wie sie sind | `results.yourTerms` |
| 157 | Starting LTV {value} | Start-LTV {value} | `results.levers.lowerLtv` |
| 158 | {value} months instead of {months} | {value} statt {months} Monate | `results.levers.shorter` |
| 159 | Keep {value} ready for a margin call | {value} für einen Margin Call bereithalten | `results.levers.reserve` |
| 160 | Margin call only a warning | Margin Call nur als Warnung | `results.levers.warningOnly` |
| 161 | Liquidation LTV {value}, other rules unchanged | Liquidations-LTV {value}, übrige Regeln gleich | `results.levers.higherLiq` |
| 162 | Liquidation LTV {value} and margin call only a warning | Liquidations-LTV {value} und Margin Call nur als Warnung | `results.levers.higherLiqWarning` |
| 163 | Pay interest every month instead of adding it | Zinsen monatlich zahlen statt addieren | `results.levers.monthlyInterest` |
| 164 | A higher liquidation LTV only helps if the margin-call rules do not sell first. Ask your lender what happens after a margin call. | Ein höherer Liquidations-LTV hilft nur, wenn die Margin-Call-Regeln nicht vorher verkaufen. Fragen Sie Ihren Kreditgeber, was nach einem Margin Call passiert. | `results.higherLiqNote` |
| 165 | Your price outlook | Ihr Kursausblick | `results.outlookTitle` |
| 166 | The simulation assumes no trend: BTC goes up and down as it did in the past, but on average stays where it is today. Choose a trend to see how much it changes the answer. The swings stay in. | Die Simulation nimmt keinen Trend an: BTC schwankt wie in der Vergangenheit, bleibt im Schnitt aber auf dem heutigen Niveau. Wählen Sie einen Trend, um zu sehen, wie stark er die Antwort ändert. Die Schwankungen bleiben drin. | `results.outlookIntro` |
| 167 | Bear | Bär | `results.presets.bear` |
| 168 | No trend | Kein Trend | `results.presets.none` |
| 169 | Moderate | Moderat | `results.presets.moderate` |
| 170 | Bull | Bulle | `results.presets.bull` |
| 171 | Generational run | Generationen-Lauf | `results.presets.run` |
| 172 | Your own: {trend} a year | Eigener Wert: {trend} pro Jahr | `results.outlookCustom` |
| 173 | For comparison, BTC's average yearly growth over 4-year periods since 2014: weakest {worst}, middle {median}, strongest {best}. It has fallen over time: {firstFrom}–{firstTo} {firstRate} a year, {lastFrom}–{lastTo} {lastRate} a year. | Zum Vergleich: Das durchschnittliche jährliche Wachstum von BTC über 4-Jahres-Zeiträume seit 2014 lag zwischen {worst} (schwächster) und {best} (stärkster), mittlerer Wert {median}. Es hat mit der Zeit abgenommen: {firstFrom}–{firstTo} {firstRate} pro Jahr, {lastFrom}–{lastTo} {lastRate} pro Jahr. | `results.outlookAnchor` |
| 174 | In {deep} of {years} calendar years since 2014, BTC fell at least 50% from a high within the same year. A loan has to survive these falls, whatever the long-term direction. | In {deep} von {years} Kalenderjahren seit 2014 fiel BTC innerhalb desselben Jahres um mindestens 50 % von einem Hoch. Ein Kredit muss diese Einbrüche überstehen, egal wohin der langfristige Weg führt. | `results.outlookSwings` |

## Section titles

| # | English | Deutsch | key |
|---|---|---|---|
| 175 | What happens when BTC falls | Was passiert, wenn BTC fällt | `sections.falls` |
| 176 | What it costs | Was es kostet | `sections.cost` |
| 177 | Borrow or sell? | Leihen oder verkaufen? | `sections.borrowOrSell` |
| 178 | Is the leverage worth it? | Lohnt sich der Hebel? | `sections.leverage` |
| 179 | What history says | Was die Vergangenheit zeigt | `sections.history` |
| 180 | How these numbers are made | Wie diese Zahlen entstehen | `sections.method` |
| 181 | Help improve this page | Helfen Sie, diese Seite zu verbessern | `sections.feedback` |

## Section: what happens when BTC falls

| # | English | Deutsch | key |
|---|---|---|---|
| 182 | Today | Heute | `falls.ladderToday` |
| 183 | Margin call | Margin Call | `falls.ladderMargin` |
| 184 | Sale | Verkauf | `falls.ladderSale` |
| 185 | At {mcPrice} (margin call): you get a warning. Adding {topUp} BTC (≈ {topUpValue}) or repaying {repay} would bring the LTV back to {target}. | Bei {mcPrice} (Margin Call): Sie erhalten eine Warnung. {topUp} BTC nachschießen (≈ {topUpValue}) oder {repay} zurückzahlen würde den LTV wieder auf {target} bringen. | `falls.marginWarning` |
| 186 | At {mcPrice} (margin call): you have {hours} hours to add {topUp} BTC (≈ {topUpValue}) or repay {repay}. Otherwise the lender sells {what}. | Bei {mcPrice} (Margin Call): Sie haben {hours} Stunden, um {topUp} BTC nachzuschießen (≈ {topUpValue}) oder {repay} zurückzuzahlen. Sonst verkauft der Kreditgeber {what}. | `falls.marginCure` |
| 187 | At {mcPrice} (margin call): the lender sells about {sold} BTC at once to bring the LTV back to {target}. The loan continues with less BTC. | Bei {mcPrice} (Margin Call): Der Kreditgeber verkauft sofort etwa {sold} BTC, um den LTV wieder auf {target} zu bringen. Der Kredit läuft mit weniger BTC weiter. | `falls.marginAuto` |
| 188 | everything | alles | `falls.whatAll` |
| 189 | just enough BTC to reach {target} | gerade so viele BTC, dass {target} erreicht wird | `falls.whatPartial` |
| 190 | At {price} (liquidation): the lender sells {sold} BTC, including the fee. You get back {returned} BTC (≈ {returnedValue}) and keep the money you borrowed. | Bei {price} (Liquidation): Der Kreditgeber verkauft {sold} BTC, inklusive Gebühr. Sie bekommen {returned} BTC zurück (≈ {returnedValue}) und behalten das geliehene Geld. | `falls.liquidationAll` |
| 191 | At {price} (liquidation): the lender sells just enough BTC to bring the LTV back to {target}. The loan continues with less BTC. | Bei {price} (Liquidation): Der Kreditgeber verkauft gerade so viele BTC, dass der LTV wieder bei {target} liegt. Der Kredit läuft mit weniger BTC weiter. | `falls.liquidationPartial` |
| 192 | 20 possible futures | 20 mögliche Zukünfte | `falls.futuresTitle` |
| 193 | Each line is one possible path of the BTC price over your loan, built from real 30-day stretches of BTC's past, joined at random. ✕ = the lender sells. {k} of these 20 end with a sale. | Jede Linie ist ein möglicher Verlauf des BTC-Kurses während Ihres Kredits, gebaut aus echten 30-Tage-Abschnitten der BTC-Vergangenheit, zufällig aneinandergereiht. ✕ = der Kreditgeber verkauft. {k} dieser 20 enden mit einem Verkauf. | `falls.futuresLine` |
| 194 | The simulation takes the real daily price moves of BTC since 2014 and cuts them into 30-day pieces. It joins randomly chosen pieces into a new path for the length of your loan. Each path keeps the real mix of calm and wild weeks. Example: one path may start with a stretch from May 2021 (a 50% fall) followed by one from late 2023 (a steady rise). | Die Simulation nimmt die echten täglichen Kursbewegungen von BTC seit 2014, schneidet sie in 30-Tage-Stücke und reiht zufällig gewählte Stücke zu einem neuen Verlauf über die Länge Ihres Kredits aneinander. Jeder Verlauf behält die echte Mischung aus ruhigen und wilden Wochen. Beispiel: Ein Verlauf kann mit einem Abschnitt aus dem Mai 2021 beginnen (ein Einbruch um 50 %), gefolgt von einem aus Ende 2023 (ein stetiger Anstieg). | `falls.futuresHelp` |
| 195 | Some ✕ sit above the red line: there, a margin call (amber line) was not fixed in time, or the lender sold part of the BTC. | Manche ✕ liegen über der roten Linie: Dort wurde ein Margin Call (gelbe Linie) nicht rechtzeitig behoben, oder der Kreditgeber hat einen Teil der BTC verkauft. | `falls.futuresMarginNote` |
| 196 | Show 20 others | 20 andere zeigen | `falls.showOthers` |
| 197 | Your lender decides which BTC price counts: one exchange, an average of several, or an average over some minutes. A single exchange can briefly drop much lower than others. This page uses the lowest price of every hour on one exchange, which is cautious, but it cannot copy your lender's method exactly. | Ihr Kreditgeber entscheidet, welcher BTC-Kurs zählt: eine Börse, ein Durchschnitt mehrerer oder ein Durchschnitt über einige Minuten. Eine einzelne Börse kann kurz viel tiefer fallen als andere. Diese Seite nutzt den tiefsten Kurs jeder Stunde an einer Börse; das ist vorsichtig gerechnet, kann die Methode Ihres Kreditgebers aber nicht genau nachbilden. | `falls.measure` |
| 198 | Your lender's own figures always win over this page. | Die Zahlen Ihres Kreditgebers gehen dieser Seite immer vor. | `falls.lenderWins` |
| 199 | Questions to ask a lender | Fragen an einen Kreditgeber | `falls.questionsTitle` |
| 200 | At which LTV do you sell my BTC? | Bei welchem LTV verkaufen Sie meine BTC? | `falls.questions.0` |
| 201 | What exactly happens after a margin call? Only a warning, or a sale after a number of hours? Everything or only part? | Was genau passiert nach einem Margin Call? Nur eine Warnung oder ein Verkauf nach einer Anzahl Stunden? Alles oder nur ein Teil? | `falls.questions.1` |
| 202 | Which BTC price do you use: one exchange, an average, over how long? | Welchen BTC-Kurs nutzen Sie: eine Börse, einen Durchschnitt, über welchen Zeitraum? | `falls.questions.2` |
| 203 | Do you sell all my BTC or only as much as needed? | Verkaufen Sie alle meine BTC oder nur so viel wie nötig? | `falls.questions.3` |
| 204 | What does a liquidation cost? | Was kostet eine Liquidation? | `falls.questions.4` |
| 205 | Who holds my BTC? Is it kept separate? Is it lent out? | Wer verwahrt meine BTC? Werden sie getrennt aufbewahrt? Werden sie weiterverliehen? | `falls.questions.5` |
| 206 | Not included in any number here: the lender itself can fail, freeze withdrawals or lose the BTC, and some lenders lend out the BTC you pledge ([[rehypothecation]]). | In keiner Zahl hier enthalten: Der Kreditgeber selbst kann pleitegehen, Auszahlungen stoppen oder die BTC verlieren, und manche Kreditgeber verleihen die hinterlegten BTC weiter ([[rehypothecation]]). | `falls.counterparty` |

## Section: costs, borrow or sell, leverage

| # | English | Deutsch | key |
|---|---|---|---|
| 207 | You receive {received} and pay back {payback}. The loan costs {cost} if nothing goes wrong ({apr} a year including fees). | Sie erhalten {received} und zahlen {payback} zurück. Der Kredit kostet {cost}, wenn nichts schiefgeht ({apr} pro Jahr inklusive Gebühren). | `cost.line` |
| 208 | You pay back {payback} in total from today, of which {interest} is interest. | Sie zahlen ab heute insgesamt {payback} zurück, davon {interest} Zinsen. | `cost.lineExisting` |
| 209 | Show the monthly payment plan | Monatlichen Zahlungsplan anzeigen | `cost.schedule` |
| 210 | Month | Monat | `cost.scheduleHead.0` |
| 211 | Date | Datum | `cost.scheduleHead.1` |
| 212 | Interest | Zinsen | `cost.scheduleHead.2` |
| 213 | Repayment | Tilgung | `cost.scheduleHead.3` |
| 214 | Payment | Zahlung | `cost.scheduleHead.4` |
| 215 | Owed afterwards | Restschuld danach | `cost.scheduleHead.5` |
| 216 | Borrowing only beats selling BTC today if BTC rises enough. Assuming you repay by selling BTC at the end: | Leihen schlägt den Verkauf von BTC heute nur, wenn BTC genug steigt. Angenommen, Sie zahlen am Ende durch einen BTC-Verkauf zurück: | `cost.sellIntro` |
| 217 | BTC must be at least {rise} higher at the end, and the loan must not be liquidated on the way. | BTC muss am Ende mindestens {rise} höher stehen, und der Kredit darf unterwegs nicht liquidiert werden. | `cost.breakeven` |
| 218 | Tax if you sell BTC today | Steuer bei BTC-Verkauf heute | `cost.taxNow` |
| 219 | Tax if you sell at the end | Steuer bei Verkauf am Ende | `cost.taxLater` |
| 220 | Enter your own tax rates (0 if none). Rules differ by country and holding period; ask a tax adviser. A liquidation is a sale too and may be taxed. | Geben Sie Ihre eigenen Steuersätze ein (0, wenn keine). Die Regeln hängen von Land und Haltedauer ab; fragen Sie eine Steuerberatung. Auch eine Liquidation ist ein Verkauf und kann besteuert werden. | `cost.taxNote` |
| 221 | With {received} you buy {bought} BTC today. | Mit {received} kaufen Sie heute {bought} BTC. | `cost.levIntro` |
| 222 | In {more} of 100 futures you end with more BTC than without the loan. In {less} of 100 with less ({liq} of them liquidated). | In {more} von 100 Zukünften haben Sie am Ende mehr BTC als ohne Kredit. In {less} von 100 weniger ({liq} davon liquidiert). | `cost.levHeadline` |
| 223 | more BTC | mehr BTC | `cost.levLegendMore` |
| 224 | less, not sold | weniger, nicht verkauft | `cost.levLegendLess` |
| 225 | liquidated | liquidiert | `cost.levLegendLiq` |
| 226 | If liquidated, you end with about {end} BTC instead of {start} BTC, even though you bought more. | Bei einer Liquidation haben Sie am Ende etwa {end} BTC statt {start} BTC, obwohl Sie mehr gekauft haben. | `cost.levLiquidated` |
| 227 | Breakeven: BTC must be {rise} higher at the end, without a sale on the way. | Gewinnschwelle: BTC muss am Ende {rise} höher stehen, ohne Verkauf unterwegs. | `cost.levBreakeven` |
| 228 | Repaying with new money: you keep the bought BTC unless your collateral is sold, and pay {payback} from other money. | Rückzahlung mit neuem Geld: Sie behalten die gekauften BTC, sofern Ihre Sicherheit nicht verkauft wird, und zahlen {payback} aus anderem Geld. | `cost.levCash` |
| 229 | Since 2014, BTC was higher 4 years later on {h4} of start days in this page's data. One year later it was higher on only {h1}, and the worst year ended {w1}. A loan has to survive the path, not just reach the destination. The past does not guarantee the future. | Seit 2014 stand BTC 4 Jahre später an {h4} der Starttage in den Daten dieser Seite höher. Ein Jahr später nur an {h1}, und das schlechteste Jahr endete bei {w1}. Ein Kredit muss den Weg überstehen, nicht nur das Ziel erreichen. Die Vergangenheit garantiert nicht die Zukunft. | `cost.levFacts` |

## Section: what history says

| # | English | Deutsch | key |
|---|---|---|---|
| 230 | Started on any day since 2014, this exact loan would have been liquidated {n} times in 100{partial}. | An einem beliebigen Tag seit 2014 gestartet, wäre genau dieser Kredit {n}-mal von 100 liquidiert worden{partial}. | `history.replay` |
| 231 | , and in {m} more, part of the BTC would have been sold | , und in {m} weiteren Fällen wäre ein Teil der BTC verkauft worden | `history.replayPartial` |
| 232 | If one of these real years started today | Wenn eines dieser echten Jahre heute begänne | `history.storiesTitle` |
| 233 | Your loan, on real BTC prices from these start dates, scaled to today's price. ✕ = sale. Dotted = what happened afterwards. | Ihr Kredit, mit echten BTC-Kursen ab diesen Starttagen, skaliert auf den heutigen Kurs. ✕ = Verkauf. Gestrichelt = was danach geschah. | `history.storiesLine` |
| 234 | {date}: sold after {days} days. One year later BTC was {end}× the start. | {date}: nach {days} Tagen verkauft. Ein Jahr später stand BTC beim {end}-fachen des Starts. | `history.sold` |
| 235 | {date}: part sold after {days} days; you keep {left} of your BTC. | {date}: nach {days} Tagen teilweise verkauft; Sie behalten {left} Ihrer BTC. | `history.partial` |
| 236 | {date}: no sale. One year later BTC was {end}× the start. | {date}: kein Verkauf. Ein Jahr später stand BTC beim {end}-fachen des Starts. | `history.survived` |
| 237 | More than half of all liquidations in the simulation happen in the first {months} months. | Mehr als die Hälfte aller Liquidationen in der Simulation passiert in den ersten {months} Monaten. | `history.byMonth` |

## Section: how these numbers are made

| # | English | Deutsch | key |
|---|---|---|---|
| 238 | Price data: hourly prices from the exchanges Bitstamp (USD since 2014, EUR since 2017) and Kraken (EUR 2014–2016), as published by the exchanges. | Kursdaten: stündliche Kurse der Börsen Bitstamp (USD seit 2014, EUR seit 2017) und Kraken (EUR 2014–2016), wie von den Börsen veröffentlicht. | `method.text.0` |
| 239 | Possible futures: real daily price moves since 2014, cut into 30-day pieces and joined at random into 10,000 paths. Each day's lowest price counts, so short crashes are not missed. A second method (a [[garch]] model, in which wild days make more wild days likely) checks the first. | Mögliche Zukünfte: echte tägliche Kursbewegungen seit 2014, in 30-Tage-Stücke geschnitten und zufällig zu 10.000 Verläufen aneinandergereiht. Der tiefste Kurs jedes Tages zählt, kurze Einbrüche gehen also nicht verloren. Eine zweite Methode (ein [[garch]], in dem wilde Tage weitere wilde Tage wahrscheinlicher machen) prüft die erste. | `method.text.1` |
| 240 | History: the same loan, started on every day since 2014, against the real lowest price of every hour. | Vergangenheit: derselbe Kredit, an jedem Tag seit 2014 gestartet, gegen den echten tiefsten Kurs jeder Stunde. | `method.text.2` |
| 241 | The lender's rules (margin call, deadlines, partial sales, fees) are applied exactly as you set them, in every path. | Die Regeln des Kreditgebers (Margin Call, Fristen, Teilverkäufe, Gebühren) werden in jedem Verlauf genau so angewendet, wie Sie sie einstellen. | `method.text.3` |
| 242 | Tested against history: from 2016 on, the method only saw the past and then predicted the lowest price of the next 90 and 365 days. Reality fell below its "worst 5%" level in 0 to 6 of 100 cases, close to or below the promised 5. The method is cautious rather than optimistic. | An der Vergangenheit getestet: Ab 2016 sah die Methode nur die Vergangenheit und sagte dann den tiefsten Kurs der nächsten 90 und 365 Tage voraus. Die Wirklichkeit lag in 0 bis 6 von 100 Fällen unter ihrem "schlechtesten 5 %"-Wert, nahe an oder unter den versprochenen 5. Die Methode ist eher vorsichtig als optimistisch. | `method.text.4` |
| 243 | No trend is assumed unless you choose a price outlook, because with BTC's past average growth built in, the test against history failed. | Ohne gewählten Kursausblick wird kein Trend angenommen, denn mit dem früheren Durchschnittswachstum von BTC fiel der Test an der Vergangenheit durch. | `method.text.5` |
| 244 | All code, data and tests are open: {link} | Der gesamte Code, die Daten und die Tests sind offen: {link} | `method.code` |
| 245 | Expert details | Details für Fachleute | `method.expert` |
| 246 | Methods compared (liquidated, of 100) | Methoden im Vergleich (liquidiert, von 100) | `method.compareTitle` |
| 247 | Possible futures from past price moves | Mögliche Zukünfte aus früheren Kursbewegungen | `method.compareRows.bootstrap` |
| 248 | Volatility model (GARCH) | Volatilitätsmodell (GARCH) | `method.compareRows.garch` |
| 249 | Real history since 2014 | Echte Vergangenheit seit 2014 | `method.compareRows.replay` |
| 250 | Textbook formula (calm, regular moves) | Lehrbuchformel (ruhige, gleichmäßige Bewegungen) | `method.compareRows.barrier` |
| 251 | The textbook formula assumes calm, regular price moves (volatility {sigma} a year) and ignores the margin-call rules, so it tends to show a lower number. It is a sanity check only. | Die Lehrbuchformel nimmt ruhige, gleichmäßige Kursbewegungen an (Volatilität {sigma} pro Jahr) und lässt die Margin-Call-Regeln außen vor; sie zeigt deshalb eher eine niedrigere Zahl. Sie dient nur zur Plausibilitätsprüfung. | `method.barrierNote` |
| 252 | Range of simulated prices | Spanne der simulierten Kurse | `method.fanTitle` |
| 253 | Each month: 9 of 10 simulated prices lie in the light band, half in the dark band; the line is the middle one. The bands show prices, not outcomes: a path that dips below the sale line and recovers still ended in a sale. | Jeden Monat: 9 von 10 simulierten Kursen liegen im hellen Band, die Hälfte im dunklen; die Linie ist der mittlere. Die Bänder zeigen Kurse, keine Ergebnisse: Ein Verlauf, der unter die Verkaufslinie taucht und sich erholt, endete trotzdem mit einem Verkauf. | `method.fanNote` |
| 254 | Liquidated by the end of each month (of 100) | Liquidiert bis zum Ende jedes Monats (von 100) | `method.byMonthTitle` |
| 255 | Settings used: {paths} futures, {block}-day stretches, data {from} to {to}. | Verwendete Einstellungen: {paths} Zukünfte, {block}-Tage-Abschnitte, Daten {from} bis {to}. | `method.settings` |

## Feedback panel

| # | English | Deutsch | key |
|---|---|---|---|
| 256 | Four short questions. Your answers go into an e-mail in your own mail app, and you decide whether to send it. Nothing is sent by this page. | Vier kurze Fragen. Ihre Antworten landen in einer E-Mail in Ihrem eigenen Mailprogramm, und Sie entscheiden, ob Sie sie senden. Diese Seite sendet nichts. | `feedback.intro` |
| 257 | What will you mainly use the money for? | Wofür nutzen Sie das Geld vor allem? | `feedback.use` |
| 258 | Spend it | Ausgeben | `feedback.useOptions.spend` |
| 259 | Compare offers | Angebote vergleichen | `feedback.useOptions.compare` |
| 260 | Buy more BTC | Mehr BTC kaufen | `feedback.useOptions.buy` |
| 261 | Just curious | Nur neugierig | `feedback.useOptions.curious` |
| 262 | In one sentence: what does the big number at the top mean? | In einem Satz: Was bedeutet die große Zahl oben? | `feedback.meaning` |
| 263 | This page gives me what I need to decide. | Diese Seite gibt mir, was ich für meine Entscheidung brauche. | `feedback.useful` |
| 264 | This page is easy to use. | Diese Seite ist einfach zu benutzen. | `feedback.easy` |
| 265 | not at all | gar nicht | `feedback.scaleLow` |
| 266 | fully | voll und ganz | `feedback.scaleHigh` |
| 267 | What was confusing, or what is missing? (optional) | Was war verwirrend, oder was fehlt? (optional) | `feedback.missing` |
| 268 | Attach my loan terms (no personal data) | Meine Kreditbedingungen anhängen (keine persönlichen Daten) | `feedback.attach` |
| 269 | Write e-mail | E-Mail schreiben | `feedback.write` |
| 270 | Copy text | Text kopieren | `feedback.copy` |
| 271 | Copied. Send it to {email}. | Kopiert. Senden Sie ihn an {email}. | `feedback.copied` |
| 272 | BTC loan check feedback | Feedback BTC-Kredit-Check | `feedback.subject` |

## Donation box

| # | English | Deutsch | key |
|---|---|---|---|
| 273 | This page is free and has no ads. If it helped you, you can support its upkeep with a Bitcoin donation. | Diese Seite ist kostenlos und werbefrei. Wenn sie Ihnen geholfen hat, können Sie ihren Betrieb mit einer Bitcoin-Spende unterstützen. | `donate.text` |
| 274 | Copy address | Adresse kopieren | `donate.copy` |
| 275 | Address copied | Adresse kopiert | `donate.copied` |
| 276 | Donations on the Bitcoin network are public. | Spenden im Bitcoin-Netzwerk sind öffentlich einsehbar. | `donate.public` |

## Footer

| # | English | Deutsch | key |
|---|---|---|---|
| 277 | Open source under the MIT licence. Provided "as is", without warranty of any kind: use it at your own risk. | Open Source unter der MIT-Lizenz. Bereitgestellt "wie besehen" ("as is"), ohne jede Gewährleistung: Nutzung auf eigenes Risiko. | `footer.license` |
| 278 | This page is not financial, investment or tax advice. It is a calculator with a model of past price moves. It cannot know your situation or the future. Check every number against your lender's documents. | Diese Seite ist keine Finanz-, Anlage- oder Steuerberatung. Sie ist ein Rechner mit einem Modell früherer Kursbewegungen. Sie kennt weder Ihre Lage noch die Zukunft. Prüfen Sie jede Zahl anhand der Unterlagen Ihres Kreditgebers. | `footer.notAdvice` |
| 279 | Everything you type stays in your browser; this page has no server of its own, no tracking and no cookies. It remembers your inputs in your browser's local storage; "Forget my inputs" deletes them. When the page opens, your browser asks public price services for the current BTC price: api.coinbase.com, and only if that fails api.kraken.com, api.binance.com or api.coingecko.com; it also loads recent hourly prices from www.bitstamp.net. These services see your IP address and browser type, but nothing you entered. A copied link contains your inputs after the "#" sign, which browsers do not send to any server. The page itself is hosted by GitHub Pages. | Alles, was Sie eingeben, bleibt in Ihrem Browser; diese Seite hat keinen eigenen Server, kein Tracking und keine Cookies. Sie merkt sich Ihre Eingaben im lokalen Speicher Ihres Browsers; "Meine Eingaben löschen" entfernt sie. Beim Öffnen fragt Ihr Browser öffentliche Kursdienste nach dem aktuellen BTC-Kurs: api.coinbase.com und nur wenn das scheitert api.kraken.com, api.binance.com oder api.coingecko.com; außerdem lädt er die neuesten Stundenkurse von www.bitstamp.net. Diese Dienste sehen Ihre IP-Adresse und Ihren Browsertyp, aber nichts von Ihren Eingaben. Ein kopierter Link enthält Ihre Eingaben nach dem "#"-Zeichen; diesen Teil senden Browser an keinen Server. Die Seite selbst wird von GitHub Pages bereitgestellt. | `footer.privacy` |
| 280 | Data: Bitstamp (USD 2014–, EUR 2017–), Kraken (EUR 2014–2016). Current price: Coinbase, Kraken, Binance or CoinGecko. Known gap: Bitstamp was offline from 5 to 9 January 2015. | Daten: Bitstamp (USD ab 2014, EUR ab 2017), Kraken (EUR 2014–2016). Aktueller Kurs: Coinbase, Kraken, Binance oder CoinGecko. Bekannte Lücke: Bitstamp war vom 5. bis 9. Januar 2015 offline. | `footer.sources` |

## Glossary

| # | English | Deutsch | key |
|---|---|---|---|
| 281 | Glossary | Glossar | `glossary.title` |
| 282 | LTV (loan-to-value) | LTV (Loan-to-Value, Beleihungsquote) | `glossary.terms.ltv.term` |
| 283 | The loan divided by the value of the pledged BTC, in percent. Loan €10,000 and BTC worth €20,000 means an LTV of 50%. When the BTC price falls, the LTV rises. | Der Kredit geteilt durch den Wert der hinterlegten BTC, in Prozent. Kredit 10.000 € und BTC im Wert von 20.000 € ergibt einen LTV von 50 %. Fällt der BTC-Kurs, steigt der LTV. | `glossary.terms.ltv.text` |
| 284 | Margin call | Margin Call (Nachschussaufforderung) | `glossary.terms.marginCall.term` |
| 285 | A warning from the lender that your LTV has risen to a set level. Depending on the lender, you must add BTC or repay part of the loan within some hours, or the lender sells part of your BTC. | Eine Warnung des Kreditgebers, dass Ihr LTV eine festgelegte Stufe erreicht hat. Je nach Kreditgeber müssen Sie innerhalb einiger Stunden BTC nachschießen oder einen Teil zurückzahlen, oder der Kreditgeber verkauft einen Teil Ihrer BTC. | `glossary.terms.marginCall.text` |
| 286 | Liquidation | Liquidation (Verwertung) | `glossary.terms.liquidation.term` |
| 287 | The lender sells your pledged BTC to repay the loan, without asking you. It happens when the LTV reaches the liquidation level, or when a margin call is not fixed in time. | Der Kreditgeber verkauft Ihre hinterlegten BTC, um den Kredit zu tilgen, ohne Sie zu fragen. Das passiert, wenn der LTV die Liquidationsschwelle erreicht oder ein Margin Call nicht rechtzeitig behoben wird. | `glossary.terms.liquidation.text` |
| 288 | Partial sale | Teilverkauf | `glossary.terms.partialLiquidation.term` |
| 289 | The lender sells only part of your BTC, enough to bring the LTV back to a lower level. The loan continues, with less BTC behind it. | Der Kreditgeber verkauft nur einen Teil Ihrer BTC, gerade genug, um den LTV wieder auf eine niedrigere Stufe zu bringen. Der Kredit läuft weiter, mit weniger BTC dahinter. | `glossary.terms.partialLiquidation.text` |
| 290 | Collateral | Sicherheit (Collateral) | `glossary.terms.collateral.term` |
| 291 | Something you give as security for a loan. Here: your BTC. You get it back when the loan is repaid. | Etwas, das Sie als Pfand für einen Kredit geben. Hier: Ihre BTC. Sie bekommen sie zurück, wenn der Kredit getilgt ist. | `glossary.terms.collateral.text` |
| 292 | Cure period | Nachschussfrist | `glossary.terms.curePeriod.term` |
| 293 | The time you have after a margin call to fix it, for example by adding BTC. | Die Zeit, die Sie nach einem Margin Call haben, um ihn zu beheben, zum Beispiel durch zusätzliche BTC. | `glossary.terms.curePeriod.text` |
| 294 | Origination fee | Abschlussgebühr | `glossary.terms.originationFee.term` |
| 295 | A one-off fee for opening the loan. It can be taken from the money you receive. | Eine einmalige Gebühr für die Eröffnung des Kredits. Sie kann vom ausgezahlten Geld abgezogen werden. | `glossary.terms.originationFee.text` |
| 296 | APR vs. interest rate | Effektivzins vs. Sollzins | `glossary.terms.aprVsRate.term` |
| 297 | The interest rate is the price of borrowing before fees. The effective APR adds fees and the timing of payments, as one yearly percentage. | Der Sollzins ist der Preis des Leihens ohne Gebühren. Der Effektivzins rechnet Gebühren und Zahlungszeitpunkte mit ein, als ein jährlicher Prozentsatz. | `glossary.terms.aprVsRate.text` |
| 298 | Compounding | Zinseszins | `glossary.terms.compounding.term` |
| 299 | Interest that is added to the debt also earns interest. The debt grows a little faster. | Zinsen, die zur Schuld addiert werden, kosten selbst wieder Zinsen. Die Schuld wächst etwas schneller. | `glossary.terms.compounding.text` |
| 300 | Day count | Zinstageberechnung | `glossary.terms.dayCount.term` |
| 301 | The rule for turning a yearly rate into interest for a period: each month as one twelfth of a year, or the actual days. | Die Regel, mit der aus einem Jahreszins die Zinsen für einen Zeitraum werden: jeder Monat als ein Zwölftel des Jahres oder die tatsächlichen Tage. | `glossary.terms.dayCount.text` |
| 302 | Drawdown | Drawdown (Kursrückgang) | `glossary.terms.drawdown.term` |
| 303 | How far a price falls from an earlier high. From €60,000 down to €30,000 is a drawdown of 50%. | Wie stark ein Kurs von einem früheren Hoch fällt. Von 60.000 € auf 30.000 € ist ein Drawdown von 50 %. | `glossary.terms.drawdown.text` |
| 304 | OHLC (candle) | OHLC (Kerze) | `glossary.terms.ohlc.term` |
| 305 | Four prices for a period such as one hour: open, high, low, close. This page uses the low of every hour to check for sales. | Vier Kurse für einen Zeitraum wie eine Stunde: Eröffnung, Hoch, Tief, Schluss. Diese Seite prüft mit dem Tief jeder Stunde, ob verkauft wird. | `glossary.terms.ohlc.text` |
| 306 | Price index | Kursindex | `glossary.terms.priceIndex.term` |
| 307 | The price source a lender uses to value your BTC: one exchange, or an average of several. It decides when a margin call or sale happens. | Die Kursquelle, mit der ein Kreditgeber Ihre BTC bewertet: eine Börse oder ein Durchschnitt mehrerer. Sie entscheidet, wann ein Margin Call oder Verkauf passiert. | `glossary.terms.priceIndex.text` |
| 308 | Counterparty risk | Gegenparteirisiko | `glossary.terms.counterpartyRisk.term` |
| 309 | The risk that the other side, here the lender, does not keep its promise, for example because it goes bankrupt. | Das Risiko, dass die andere Seite, hier der Kreditgeber, ihr Versprechen nicht hält, zum Beispiel weil sie pleitegeht. | `glossary.terms.counterpartyRisk.text` |
| 310 | Rehypothecation | Rehypothekierung (Weiterverleihen) | `glossary.terms.rehypothecation.term` |
| 311 | The lender lends out or reuses the BTC you pledged. If the lender gets into trouble, your BTC may be gone. | Der Kreditgeber verleiht die BTC, die Sie hinterlegt haben, weiter oder nutzt sie anderweitig. Gerät der Kreditgeber in Schwierigkeiten, können Ihre BTC weg sein. | `glossary.terms.rehypothecation.text` |
| 312 | Simulated future | Simulierte Zukunft | `glossary.terms.simulatedFuture.term` |
| 313 | One possible path of the BTC price over your loan, built from real past price moves. Counting what happens in many of them gives a chance in "N of 100". | Ein möglicher Verlauf des BTC-Kurses während Ihres Kredits, gebaut aus echten früheren Kursbewegungen. Zählt man, was in vielen davon passiert, ergibt sich eine Häufigkeit "N von 100". | `glossary.terms.simulatedFuture.text` |
| 314 | Block bootstrap | Block-Bootstrap | `glossary.terms.blockBootstrap.term` |
| 315 | The method behind the simulated futures: pieces of real price history (30 days each) are picked at random and joined together. | Die Methode hinter den simulierten Zukünften: Stücke echter Kurshistorie (je 30 Tage) werden zufällig ausgewählt und aneinandergereiht. | `glossary.terms.blockBootstrap.text` |
| 316 | GARCH model | GARCH-Modell | `glossary.terms.garch.term` |
| 317 | A statistics model for prices in which wild days make further wild days more likely, and very large moves happen more often than in the textbook model. | Ein Statistikmodell für Kurse, in dem wilde Tage weitere wilde Tage wahrscheinlicher machen und sehr große Bewegungen häufiger vorkommen als im Lehrbuchmodell. | `glossary.terms.garch.text` |
| 318 | Historical replay | Nachspielen der Vergangenheit | `glossary.terms.historicalReplay.term` |
| 319 | The loan is started on every past day and checked against what the price really did afterwards. | Der Kredit wird an jedem früheren Tag gestartet und mit dem verglichen, was der Kurs danach wirklich getan hat. | `glossary.terms.historicalReplay.text` |
| 320 | Price outlook | Kursausblick | `glossary.terms.priceOutlook.term` |
| 321 | An assumed average yearly price change. It shifts all simulated futures up or down; the swings stay the same. | Eine angenommene durchschnittliche jährliche Kursänderung. Sie verschiebt alle simulierten Zukünfte nach oben oder unten; die Schwankungen bleiben gleich. | `glossary.terms.priceOutlook.text` |

## Error messages

| # | English | Deutsch | key |
|---|---|---|---|
| 322 | The loan amount must be a number above zero. | Der Kreditbetrag muss eine Zahl über null sein. | `errors.LOAN_AMOUNT_INVALID.problem` |
| 323 | Enter the amount from your offer, for example 10000. | Geben Sie den Betrag aus Ihrem Angebot ein, zum Beispiel 10000. | `errors.LOAN_AMOUNT_INVALID.fix` |
| 324 | The BTC price must be a number above zero. | Der BTC-Kurs muss eine Zahl über null sein. | `errors.PRICE_INVALID.problem` |
| 325 | Load the current price or type today's price. | Laden Sie den aktuellen Kurs oder geben Sie den heutigen Kurs ein. | `errors.PRICE_INVALID.fix` |
| 326 | The starting LTV must be between 0% and 100%. | Der Start-LTV muss zwischen 0 % und 100 % liegen. | `errors.LTV_OUT_OF_RANGE.problem` |
| 327 | Enter the LTV from your offer, for example 50. | Geben Sie den LTV aus Ihrem Angebot ein, zum Beispiel 50. | `errors.LTV_OUT_OF_RANGE.fix` |
| 328 | The liquidation LTV is not higher than the starting LTV. The loan would be liquidated at once. | Der Liquidations-LTV ist nicht höher als der Start-LTV. Der Kredit würde sofort liquidiert. | `errors.LIQ_LTV_NOT_ABOVE_INITIAL.problem` |
| 329 | Check both numbers. The liquidation LTV must be higher, for example 50% at the start and 80% for liquidation. | Prüfen Sie beide Zahlen. Der Liquidations-LTV muss höher sein, zum Beispiel 50 % zu Beginn und 80 % für die Liquidation. | `errors.LIQ_LTV_NOT_ABOVE_INITIAL.fix` |
| 330 | The liquidation LTV must be a number up to 100%. | Der Liquidations-LTV muss eine Zahl bis 100 % sein. | `errors.LIQ_LTV_TOO_HIGH.problem` |
| 331 | Enter the liquidation LTV from your offer, for example 80. | Geben Sie den Liquidations-LTV aus Ihrem Angebot ein, zum Beispiel 80. | `errors.LIQ_LTV_TOO_HIGH.fix` |
| 332 | The margin-call LTV must lie between the starting LTV and the liquidation LTV. | Der Margin-Call-LTV muss zwischen Start-LTV und Liquidations-LTV liegen. | `errors.MARGIN_LTV_OUT_OF_RANGE.problem` |
| 333 | Check the number, or leave it empty if your offer has no margin call. | Prüfen Sie die Zahl oder lassen Sie das Feld leer, wenn Ihr Angebot keinen Margin Call hat. | `errors.MARGIN_LTV_OUT_OF_RANGE.fix` |
| 334 | The duration must be a whole number of months, at least 1. | Die Laufzeit muss eine ganze Zahl von Monaten sein, mindestens 1. | `errors.DURATION_INVALID.problem` |
| 335 | Enter the months, for example 12 for one year. | Geben Sie die Monate ein, zum Beispiel 12 für ein Jahr. | `errors.DURATION_INVALID.fix` |
| 336 | An interest rate cannot be negative here. | Ein Zinssatz kann hier nicht negativ sein. | `errors.NEGATIVE_RATE.problem` |
| 337 | Enter the rate as a positive number, for example 10, or 0. | Geben Sie den Zins als positive Zahl ein, zum Beispiel 10, oder 0. | `errors.NEGATIVE_RATE.fix` |
| 338 | The rate changes are not in order, do not start at month 0, or go past the end of the loan. | Die Zinsänderungen sind nicht in der richtigen Reihenfolge, beginnen nicht bei Monat 0 oder reichen über das Laufzeitende hinaus. | `errors.RATE_PATH_INVALID.problem` |
| 339 | Start with month 0, then add later months in increasing order, all before the end. | Beginnen Sie mit Monat 0 und fügen Sie spätere Monate aufsteigend hinzu, alle vor dem Ende. | `errors.RATE_PATH_INVALID.fix` |
| 340 | A fee cannot be negative, and a percentage fee must be below 100%. | Eine Gebühr kann nicht negativ sein, und eine Gebühr in Prozent muss unter 100 % liegen. | `errors.NEGATIVE_FEE.problem` |
| 341 | Enter the fee from your offer, or 0. | Geben Sie die Gebühr aus Ihrem Angebot ein, oder 0. | `errors.NEGATIVE_FEE.fix` |
| 342 | The origination fee is as large as the loan or larger. | Die Abschlussgebühr ist so groß wie der Kredit oder größer. | `errors.FEE_EXCEEDS_LOAN.problem` |
| 343 | Check whether the fee is a percentage or a fixed amount. | Prüfen Sie, ob die Gebühr ein Prozentsatz oder ein fester Betrag ist. | `errors.FEE_EXCEEDS_LOAN.fix` |
| 344 | The time to top up cannot be negative. | Die Zeit zum Nachschießen kann nicht negativ sein. | `errors.CURE_NEGATIVE.problem` |
| 345 | Enter the hours from your offer. | Geben Sie die Stunden aus Ihrem Angebot ein. | `errors.CURE_NEGATIVE.fix` |
| 346 | A tax rate must be between 0% and below 100%. | Ein Steuersatz muss zwischen 0 % und unter 100 % liegen. | `errors.TAX_RATE_INVALID.problem` |
| 347 | Enter a percentage such as 25, or 0. | Geben Sie einen Prozentsatz wie 25 ein, oder 0. | `errors.TAX_RATE_INVALID.fix` |
| 348 | The amount kept ready cannot be negative. | Der bereitgehaltene Betrag kann nicht negativ sein. | `errors.RESERVE_NEGATIVE.problem` |
| 349 | Enter an amount, or 0. | Geben Sie einen Betrag ein, oder 0. | `errors.RESERVE_NEGATIVE.fix` |
| 350 | The LTV the lender brings you back to must be above 0% and below the margin-call LTV. | Der LTV, auf den der Kreditgeber Sie zurückbringt, muss über 0 % und unter dem Margin-Call-LTV liegen. | `errors.CURE_TARGET_INVALID.problem` |
| 351 | Leave it empty to use your starting LTV, or enter the number from your offer. | Lassen Sie das Feld leer, um Ihren Start-LTV zu verwenden, oder geben Sie die Zahl aus Ihrem Angebot ein. | `errors.CURE_TARGET_INVALID.fix` |
| 352 | The amount of BTC pledged must be a number above zero. | Die Menge der hinterlegten BTC muss eine Zahl über null sein. | `errors.COLLATERAL_INVALID.problem` |
| 353 | Enter the BTC amount, for example 0.25. | Geben Sie die BTC-Menge ein, zum Beispiel 0,25. | `errors.COLLATERAL_INVALID.fix` |
| 354 | With these numbers, your LTV today is already at or above the liquidation LTV. | Mit diesen Zahlen liegt Ihr LTV heute schon beim Liquidations-LTV oder darüber. | `errors.EXISTING_LOAN_AT_LIQUIDATION.problem` |
| 355 | Check the amount owed, the BTC pledged and the BTC price. If they are right, contact your lender now. | Prüfen Sie den geschuldeten Betrag, die hinterlegten BTC und den BTC-Kurs. Stimmen sie, wenden Sie sich jetzt an Ihren Kreditgeber. | `errors.EXISTING_LOAN_AT_LIQUIDATION.fix` |

## Impressum and privacy notice (templates; review by a lawyer)

| # | English | Deutsch | key |
|---|---|---|---|
| 356 | Template: the parts in «angle quotes» must be filled in, and the text should be checked by a lawyer before publishing. | Vorlage: Die Teile in «Winkelanführungszeichen» müssen ausgefüllt werden, und der Text sollte vor der Veröffentlichung anwaltlich geprüft werden. | `legal.templateNote` |
| 357 | Legal notice (Impressum) | Impressum | `legal.impressumTitle` |
| 358 | Information under § 5 DDG (German Digital Services Act), if it applies to this page: | Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz), soweit für diese Seite anwendbar: | `legal.impressum.0` |
| 359 | «First and last name» | «Vor- und Nachname» | `legal.impressum.1` |
| 360 | «Street and house number», «Postcode and town», «Country» | «Straße und Hausnummer», «PLZ und Ort», «Land» | `legal.impressum.2` |
| 361 | Contact: {email} | Kontakt: {email} | `legal.impressum.3` |
| 362 | Responsible for the content under § 18 (2) MStV: «First and last name, address as above» | Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: «Vor- und Nachname, Anschrift wie oben» | `legal.impressum.4` |
| 363 | This page is a free, private calculator. It does not offer loans, does not arrange loans, and has no business relationship with any lender. | Diese Seite ist ein kostenloser, privater Rechner. Sie bietet keine Kredite an, vermittelt keine Kredite und steht in keiner Geschäftsbeziehung zu einem Kreditgeber. | `legal.impressum.5` |
| 364 | Privacy notice | Datenschutzerklärung | `legal.privacyTitle` |
| 365 | 1. Who is responsible | 1. Verantwortlicher | `legal.privacy.0.h` |
| 366 | Responsible for data processing on this page: «First and last name», «Street and house number», «Postcode and town», «Country», {email}. | Verantwortlich für die Datenverarbeitung auf dieser Seite: «Vor- und Nachname», «Straße und Hausnummer», «PLZ und Ort», «Land», {email}. | `legal.privacy.0.p.0` |
| 367 | 2. Hosting by GitHub Pages | 2. Hosting durch GitHub Pages | `legal.privacy.1.h` |
| 368 | This page is delivered by GitHub Pages, a service of GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. When you open the page, GitHub processes technical data that every web server needs: your IP address, date and time, the requested address, and your browser type. GitHub may store this data in log files. | Diese Seite wird über GitHub Pages ausgeliefert, einen Dienst der GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Aufruf der Seite verarbeitet GitHub technische Daten, die jeder Webserver benötigt: Ihre IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse und Ihren Browsertyp. GitHub kann diese Daten in Logdateien speichern. | `legal.privacy.1.p.0` |
| 369 | Legal basis: Art. 6 (1) (f) GDPR. Our legitimate interest is delivering the page securely and reliably. GitHub is located in the USA. «Check and name the legal basis for the transfer to the USA, for example the EU-US Data Privacy Framework.» GitHub privacy statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement | Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist die sichere und zuverlässige Auslieferung der Seite. GitHub hat seinen Sitz in den USA. «Rechtsgrundlage der Übermittlung in die USA prüfen und nennen, zum Beispiel das EU-US Data Privacy Framework.» Datenschutzerklärung von GitHub: https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement | `legal.privacy.1.p.1` |
| 370 | 3. Current BTC price (automatic requests when the page opens) | 3. Aktueller BTC-Kurs (automatische Abfragen beim Öffnen) | `legal.privacy.2.h` |
| 371 | To show the current BTC price, your browser contacts public price services directly when the page opens: first api.coinbase.com (Coinbase); only if that does not answer, then api.kraken.com (Kraken), api.binance.com (Binance) and api.coingecko.com (CoinGecko), one after the other. In addition, your browser loads the most recent hourly prices from www.bitstamp.net (Bitstamp). Loading the current price again or changing the currency repeats the price request. | Um den aktuellen BTC-Kurs zu zeigen, kontaktiert Ihr Browser beim Öffnen der Seite direkt öffentliche Kursdienste: zuerst api.coinbase.com (Coinbase); nur wenn dieser nicht antwortet, nacheinander api.kraken.com (Kraken), api.binance.com (Binance) und api.coingecko.com (CoinGecko). Zusätzlich lädt Ihr Browser die neuesten Stundenkurse von www.bitstamp.net (Bitstamp). Ein erneutes Laden des Kurses oder ein Wechsel der Währung wiederholt die Kursabfrage. | `legal.privacy.2.p.0` |
| 372 | These services receive your IP address, the time and your browser type, as with any visit to a website. The requests contain no cookies, no referrer and nothing that you entered in the form. We do not receive any of this data. «Add the full company name and address of each service, and the legal basis for any transfer outside the EU.» | Diese Dienste erhalten dabei Ihre IP-Adresse, die Uhrzeit und Ihren Browsertyp, wie bei jedem Besuch einer Webseite. Die Abfragen enthalten keine Cookies, keinen Referrer und nichts von dem, was Sie im Formular eingeben. Wir erhalten keine dieser Daten. «Vollständigen Firmennamen und Anschrift jedes Dienstes ergänzen, sowie die Rechtsgrundlage für Übermittlungen außerhalb der EU.» | `legal.privacy.2.p.1` |
| 373 | Legal basis: Art. 6 (1) (f) GDPR. Our legitimate interest is showing an up-to-date price, without which the results would be outdated. | Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist die Anzeige eines aktuellen Kurses, ohne den die Ergebnisse veraltet wären. | `legal.privacy.2.p.2` |
| 374 | 4. Your inputs, local storage and shared links | 4. Ihre Eingaben, lokale Speicherung und geteilte Links | `legal.privacy.3.h` |
| 375 | All calculations take place in your browser. Your inputs are not sent to us or to anyone else. | Alle Berechnungen finden in Ihrem Browser statt. Ihre Eingaben werden weder an uns noch an Dritte übermittelt. | `legal.privacy.3.p.0` |
| 376 | So that your inputs and your language choice are still there on your next visit, the page stores them in the local storage of your browser (keys "btc-loan-risk:form" and "btc-loan-risk:lang"). This data stays on your device. You can delete it at any time with the button "Forget my inputs" or in your browser settings. | Damit Ihre Eingaben und Ihre Sprachwahl beim nächsten Besuch noch vorhanden sind, speichert die Seite sie im lokalen Speicher Ihres Browsers (Schlüssel "btc-loan-risk:form" und "btc-loan-risk:lang"). Diese Daten bleiben auf Ihrem Gerät. Sie können sie jederzeit mit der Schaltfläche "Meine Eingaben löschen" oder in den Einstellungen Ihres Browsers entfernen. | `legal.privacy.3.p.1` |
| 377 | If you use "Copy link to this calculation", your inputs are written into the link after the "#" sign. Browsers do not send this part to any server, including GitHub. Whoever you give the link to can see your inputs. | Wenn Sie "Link zu dieser Berechnung kopieren" nutzen, werden Ihre Eingaben in den Link nach dem "#"-Zeichen geschrieben. Diesen Teil senden Browser an keinen Server, auch nicht an GitHub. Wer den Link von Ihnen erhält, kann Ihre Eingaben sehen. | `legal.privacy.3.p.2` |
| 378 | Legal basis: § 25 (2) No. 2 TDDDG, because the storage is strictly necessary for the function you use. «Check this assessment.» | Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG, da die Speicherung für die von Ihnen genutzte Funktion unbedingt erforderlich ist. «Diese Einschätzung prüfen.» | `legal.privacy.3.p.3` |
| 379 | 5. Feedback by e-mail | 5. Feedback per E-Mail | `legal.privacy.4.h` |
| 380 | The section "Help improve this page" prepares an e-mail in your own mail app. Nothing is sent unless you send it yourself. If you send it, we receive your e-mail address and your message, and use them only to read and answer your feedback and to improve the page. We delete them when they are no longer needed for that. | Der Bereich "Helfen Sie, diese Seite zu verbessern" bereitet eine E-Mail in Ihrem eigenen Mailprogramm vor. Es wird nichts gesendet, wenn Sie nicht selbst senden. Senden Sie die E-Mail, erhalten wir Ihre E-Mail-Adresse und Ihre Nachricht und nutzen sie nur, um Ihr Feedback zu lesen, zu beantworten und die Seite zu verbessern. Wir löschen sie, sobald sie dafür nicht mehr benötigt werden. | `legal.privacy.4.p.0` |
| 381 | Legal basis: Art. 6 (1) (f) GDPR. Our legitimate interest is improving the page and answering you. «Check this assessment and add how long you keep feedback e-mails.» | Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist die Verbesserung der Seite und die Beantwortung Ihrer Nachricht. «Diese Einschätzung prüfen und ergänzen, wie lange Feedback-E-Mails aufbewahrt werden.» | `legal.privacy.4.p.1` |
| 382 | 6. No cookies, no analytics | 6. Keine Cookies, keine Analyse | `legal.privacy.5.h` |
| 383 | This page sets no cookies and uses no analytics, tracking or advertising services. It loads no fonts, scripts or styles from other servers. | Diese Seite setzt keine Cookies und nutzt keine Analyse-, Tracking- oder Werbedienste. Sie lädt keine Schriften, Skripte oder Stile von anderen Servern. | `legal.privacy.5.p.0` |
| 384 | 7. Your rights | 7. Ihre Rechte | `legal.privacy.6.h` |
| 385 | You have the right to access, correction, deletion and restriction of processing of your personal data, the right to data portability, and the right to object to processing based on Art. 6 (1) (f) GDPR. Contact: {email}. | Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten, das Recht auf Datenübertragbarkeit sowie das Recht, einer Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO zu widersprechen. Kontakt: {email}. | `legal.privacy.6.p.0` |
| 386 | You also have the right to lodge a complaint with a data protection supervisory authority, for example «name of the authority responsible for you». | Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel bei «Name der für Sie zuständigen Behörde». | `legal.privacy.6.p.1` |
| 387 | 8. Version | 8. Stand | `legal.privacy.7.h` |
| 388 | Version of this privacy notice: «Date». | Stand dieser Datenschutzerklärung: «Datum». | `legal.privacy.7.p.0` |
| 389 | Legal notice · Privacy notice | Impressum · Datenschutzerklärung | `legal.links` |

## Page title and search description

| # | English | Deutsch | key |
|---|---|---|---|
| 390 | BTC loan check | BTC-Kredit-Check | `meta.title` |
| 391 | How likely is it that a bitcoin-backed loan gets liquidated, and what does it cost? A free, private calculator based on real BTC prices since 2014. | Wie wahrscheinlich wird ein mit Bitcoin besicherter Kredit liquidiert, und was kostet er? Ein kostenloser, privater Rechner auf Basis echter BTC-Kurse seit 2014. | `meta.description` |
