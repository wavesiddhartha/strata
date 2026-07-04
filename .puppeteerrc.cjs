/** @type {import('puppeteer').Configuration} */
module.exports = {
  // Don't download Chromium as part of `npm install`. This matters: if that
  // download is blocked by a network policy (a corporate proxy, a sandboxed
  // CI runner, anything short of unrestricted internet), the *entire*
  // `npm install` fails — not just PDF export. One fragile sub-feature
  // shouldn't be able to break the whole app's setup.
  //
  // To enable one-click PDF export, run once:
  //   npx puppeteer browsers install chrome
  // Until then, the PDF export route fails gracefully with a clear message
  // pointing at "Print / Save as PDF" as the zero-setup fallback.
  skipDownload: true,
};
