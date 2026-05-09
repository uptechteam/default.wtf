# Default Account for Google™ products (fork)

⚠️ **Disclaimer:** This is a **working prototype** — completely vibe-coded with a focus on functionality over production polish. It works well for daily use, but security hardening and code cleanup are always welcome. If you spot any security issues, improvement suggestions, or bugs, please report them!

A browser extension that automatically redirects Google and YouTube pages to your chosen account — no more landing on the wrong one.

Based on the original [DefaultWTF](https://www.default.wtf/) extension by [Uptech](https://github.com/uptechteam/default-google-account), extended with profiles, YouTube support, custom URL rules, and a full Manifest V3 rewrite.

## Features

### Quick-switch
Open the popup and instantly switch the current tab to any of your Google accounts. One click, no settings changed — just a quick account hop for the tab you're on.

### Profiles
Create named profiles (e.g. "University", "Personal", "Work") each with their own default account and per-service rules. Switch profiles with one click from the profile bar.

- **Inheritance** — non-Default profiles inherit all rules from the Default profile. Only configure what differs.
- **Override** — click "Override" on any inherited rule to set a different account just for that profile.
- **Duplicate** — clone a profile to use as a starting point.
- **Color labels** — each profile gets a color so you always know which one is active.
- **Default account per profile** — each profile has its own fallback account, configured in the profile edit form.

### Service rules
Set a specific account for any Google service. Rules in a profile take precedence over the Default profile's rules.

- 55+ supported services including YouTube, Gmail, Drive, Calendar, Meet, Gemini, Classroom, and more.
- Search/filter the service list.
- Custom URL rules — match any URL pattern (e.g. `myapp.example.com`) to a specific account.

### Profile switch redirect
Choose what happens to open Google tabs when you switch profiles:
- **Ask** (default) — a banner asks whether to redirect open tabs. Includes "Always" and "Never" shortcuts to save your preference inline.
- **Always** — silently redirect all open Google tabs.
- **Never** — switch profile without touching open tabs.

### Import / Export
Save all profiles and rules to a JSON file. Restore them on another browser or after reinstalling.

### Keyboard shortcuts
`Alt+1` through `Alt+4` switch your active Google account on the current tab. Configurable at `chrome://extensions/shortcuts`.

## Installation

### Chrome / Brave (unpacked, development mode)

1. **Clone or download** this repository to your computer.

2. **Open the extensions page** in your browser:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`

3. **Enable Developer mode** — toggle the switch in the top-right corner.

4. **Click "Load unpacked"** and select the folder you cloned/downloaded.

5. The extension will appear in your extensions list. You may pin it to the toolbar for easy access (click the pin icon next to the extension name).

### Firefox (unpacked, temporary)

Firefox doesn't support permanent unpacked extensions, but you can load them temporarily for development:

1. Open `about:debugging#/runtime/this-firefox` in the address bar.

2. Click **"Load Temporary Add-on..."** and select the `manifest.json` file from this folder.

3. The extension will be active while your browser is open. It will be unloaded when you close the browser.

**Note:** For permanent Firefox installation, you'd need to package and sign the extension, which is beyond the scope of this guide. Consider using Chrome/Brave for now.

## File overview

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (Manifest V3) |
| `service-worker.js` | Background service worker — navigation interception, profile state, messaging |
| `utils.js` | Shared utilities — URL matching, redirect logic, service catalogue, profile helpers, storage |
| `app.js` | Popup orchestrator — global state, quick-switch, profile bar, account fetching, settings, import/export |
| `rules.js` | Rules editor UI |
| `profiles.js` | Profile management UI |
| `popup.html` | Extension popup |
| `styles.css` | All styles, including dark mode |

## Contributing

This is a working prototype, not production-ready code. If you find:
- **Security issues** — please report them responsibly
- **Bugs** — feel free to open an issue or submit a fix
- **Improvements** — suggestions welcome (especially code cleanup, security hardening, or performance optimizations)

## License

BSD 3-Clause — see [LICENSE](LICENSE).
Original extension © Uptech.
