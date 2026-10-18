// "Insights": what happened to BTC-backed loans since 2014. Being built (see ux/H-content-audit.md).
import { initLang, texts, esc } from './i18n.js';
import { initShell, renderShell } from './shell.js';

const META = JSON.parse(document.getElementById('meta').textContent);
initLang();
initShell({ built: META.built });
document.title = texts().insights.metaTitle;
renderShell();
document.getElementById('groups').innerHTML = texts().insights.groups.map((g) => `<li>${esc(g)}</li>`).join('');
document.body.dataset.ready = '1';
