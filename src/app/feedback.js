// Builds the feedback e-mail. Nothing is sent by the page: the visitor's own mail
// app opens with this text, or the visitor copies it.

export function feedbackText({ use, meaning, useful, easy, missing, terms, version, lang, device }) {
  const lines = [
    `Use: ${use || '-'}`,
    `Big number means: ${meaning || '-'}`,
    `Gives me what I need: ${useful ? `${useful}/7` : '-'} · Easy to use: ${easy ? `${easy}/7` : '-'}`,
    `Confusing / missing: ${missing || '-'}`,
    `Page version: ${version} · Language: ${lang} · Device: ${device}`,
    terms ? `Loan terms: ${JSON.stringify(terms)}` : '(no loan terms attached)',
  ];
  return lines.join('\n');
}

export function mailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
