// Background worker: runs the heavy risk calculations so the page stays responsive.
// Messages in:  { type: 'data', currency, base64, appended? }  price history for a currency
//               { type: 'run', id, terms, settings, garch? }    compute all risk results
// Messages out: { type: 'progress', id, done, total }
//               { type: 'result', id, result }  |  { type: 'error', id, message }
import { setData, run } from './riskjob.js';

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'data') setData(msg.currency, msg.base64, msg.appended);
    if (msg.type === 'run') postMessage({ type: 'result', id: msg.id, result: await run(msg.id, msg.terms, msg.settings, msg.garch) });
  } catch (err) {
    postMessage({ type: 'error', id: msg.id, message: String((err && err.message) || err) });
  }
};
