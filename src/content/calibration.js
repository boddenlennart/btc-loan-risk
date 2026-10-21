// The test against history (tests/calibration.test.js), as shown on "How it works": how often reality fell
// below each method's "worst 5%" level, in percent, for the euro history. The test checks that these
// stated numbers stay within 2.5 points of what it measures, so the page never shows stale results.
// independent: about how many non-overlapping periods the forecasts hold (monthly forecasts overlap).
export const CALIBRATION = {
  measured: '2026-10-19',
  rows: [
    { model: 'simulation', days: 90, below05: 3.1, forecasts: 128, independent: 43 },
    { model: 'simulation', days: 365, below05: 0.0, forecasts: 119, independent: 10 },
    { model: 'garch', days: 90, below05: 5.5, forecasts: 128, independent: 43 },
    { model: 'garch', days: 365, below05: 0.0, forecasts: 119, independent: 10 },
  ],
};
