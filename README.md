
# <img src="images/logo.svg" alt="" width="25"/> DefaultWTF — Default Account for Google™ products

A browser extension that opens Google services with the Google account **you** choose,
instead of the first account you signed in with.

If you are signed in to several Google accounts (say, personal and work), Google always
opens Gmail, Drive, Meet, Calendar, etc. with the first one. DefaultWTF picks the right
account for you:

- **Default account** — choose the account that all Google services open with.
- **Rules** — open a specific service with a different account, e.g. Meet with your work
  account and YouTube with your personal one.
- **Keyboard shortcuts** — switch the current tab to account 1–9
  (Alt+1…4 on Windows/Linux, Control+Shift+1…4 on macOS by default, editable in the browser).
- **Toolbar icon** — shows the avatar (or number) of the account the current tab uses.
- **Pause** — turn the redirects off with one click.

Supported: Gmail, Calendar, Drive, Docs/Sheets/Slides, Meet, Chat, YouTube, Maps, Photos,
Gemini, Scholar, Cloud Console, Firebase, Analytics, Ads and
[many more](utils.js).

## How it works

Google selects the account from the `authuser` URL parameter (or `/u/N/` in the path).
When you open a Google service without one, the extension adds `?authuser=N` for the
account you chose. Links that already specify an account are left untouched. The list of
signed in accounts is read from `accounts.google.com` and never leaves your browser; your
settings (default account and rules) are synced with your browser profile.

## Install

- [Chrome Web Store](https://chrome.google.com/webstore/detail/default-google-account/bnocikekcdchphdpfffcgikiblhnkdad)
- Firefox: build from `manifest_firefox.json` (see below)

### Development

- **Chrome** (Manifest V3): open `chrome://extensions`, enable *Developer mode*,
  click *Load unpacked* and select this folder.
- **Firefox** (Manifest V2): copy `manifest_firefox.json` over `manifest.json`, then open
  `about:debugging#/runtime/this-firefox` and click *Load Temporary Add-on…*.

The same code runs on both: Chrome redirects with `declarativeNetRequest` rules, Firefox with
blocking `webRequest`.

## Links

- [Website](https://www.default.wtf/)
- [Buy us a coffee](https://www.buymeacoffee.com/default)
- [Open source license](LICENSE)

Google™ is a trademark of Google LLC. This extension is not affiliated with Google.
