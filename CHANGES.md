# Changes from the original DefaultWTF extension

This documents every change made relative to the original v1.14 extension from [Uptech](https://www.default.wtf/).

---

## Manifest V3 migration

**File:** `manifest.json`

The original used Manifest V2, which is deprecated and being phased out by Chrome and Brave.

- `manifest_version`: `2` → `3`
- `browser_action` → `action`
- `background.scripts` + `persistent: true` → `background.service_worker`
- `webRequest` + `webRequestBlocking` permissions removed — these are not available in MV3
- `<all_urls>` permission removed — replaced with explicit `host_permissions` for Google, YouTube, and Blogger domains
- Navigation interception now uses `chrome.webNavigation.onBeforeNavigate` instead of `chrome.webRequest.onBeforeRequest`
- `update_url` removed (not needed for unpacked/sideloaded extensions)
- `minimum_chrome_version` raised from `40` to `88`

**Why host_permissions are explicit:** MV3 disallows the `*.google.co.*` wildcard pattern (dots in the middle of hostnames are not allowed in match patterns). The manifest now enumerates all major Google country TLDs explicitly.

---

## Bug fixes

### `signIn()` referenced undefined variable
**File:** `accounts.js` (original)

The `signIn()` function's callback referenced `info[3]` (the raw array element) instead of `user.email`. This caused a `ReferenceError` when clicking a signed-out account.

**Fix:** Replaced with `user.email` using the correctly scoped `user` variable.

### Account #0 never redirected
**File:** `background.js` (original)

The redirect condition included `accountId !== 0`, meaning the first Google account was never enforced. If your default was account #0, the extension silently did nothing.

**Fix:** Removed the `accountId !== 0` guard. Account #0 is now handled by making `isAccountLoggedIn(0)` always return `true` (since index 0 is the primary account and always logged in by definition).

### `DOMParser` unavailable in service workers
**File:** `background.js` (original)

The account-fetching code used `new DOMParser()` to parse Google's response, but `DOMParser` is not available in MV3 service worker contexts.

**Fix:** Replaced with a regex-based script tag extraction: `rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i)`.

### Typo: `redirectCurrectTab`
**File:** `utils.js` (original)

Renamed to `redirectCurrentTab` throughout.

### Script load-order bug (introduced during rewrite, fixed here)
**File:** `popup.html`

The earlier rewrite placed `<script src="accounts.js">`, `<script src="rules.js">`, and `<script src="profiles.js">` inline inside their respective tab `<div>` elements, before `app.js` was loaded. Since all three reference `window.App` (defined in `app.js`), they would throw `ReferenceError: App is not defined` at parse time.

**Fix:** All scripts are now loaded in a single block at the end of `<body>`, in dependency order: `utils.js` → `app.js` → `accounts.js` → `rules.js` → `profiles.js`. The `app:ready` event is dispatched asynchronously after `loadProfiles()` resolves, so all listeners are guaranteed to be registered before it fires.

---

## New features

### Profiles
**Files:** `utils.js`, `service-worker.js`, `app.js`, `profiles.js`, `accounts.js`, `rules.js`, `styles.css`

The biggest new feature. Instead of a single global set of rules and a default account, the extension now supports multiple named profiles.

**Storage schema (new):**
```json
{
  "profiles": [
    {
      "id": "default",
      "name": "Default",
      "color": "#8b8792",
      "defaultAccount": 0,
      "rules": [...],
      "customServices": [...]
    },
    {
      "id": "uuid-...",
      "name": "University",
      "color": "#4a90d9",
      "defaultAccount": 1,
      "rules": [...],
      "customServices": []
    }
  ],
  "activeProfileId": "uuid-..."
}
```

**Profile features:**
- **Default profile** — always exists, cannot be deleted. Acts as the base that other profiles inherit from.
- **Inheritance** — non-Default profiles automatically inherit all rules from Default for services they haven't explicitly configured. The resolved rule list (own rules + inherited) is shown in the Rules tab with inherited rules visually distinguished.
- **Override** — clicking "Override" on an inherited rule opens an inline picker to set a different account for that service in the current profile only.
- **Create** — new profiles are created with a name and color via a form in the Settings tab or the profile modal.
- **Edit** — rename and recolor any profile (Default can be recolored but not renamed).
- **Duplicate** — clones a profile including all its rules, as a starting point.
- **Delete** — removes a profile and its rules. If the active profile is deleted, falls back to Default.
- **Activate** — sets the active profile. The service worker switches its interception logic immediately.
- **Profile bar** — a persistent strip below the header shows all profiles as colored chips. The active one is highlighted. Click any chip to switch.
- **"Redirect open tabs?" prompt** — when switching profiles, if any Google/YouTube tabs are open, a banner appears asking whether to redirect them to the new profile's accounts immediately, or switch quietly.
- **Modal** — the ⚙ gear button opens a full profile management modal with the same create/edit/duplicate/delete/activate actions.
- **Scope labels** — the Accounts and Rules tabs show which profile is being viewed/edited.

**Legacy migration:** On first update from v1.x, any existing `rules`, `defaultAccount`, and `customServices` stored at the root of `chrome.storage.sync` are automatically migrated into the Default profile.

### YouTube support
**Files:** `utils.js`, `service-worker.js`, `manifest.json`

YouTube is now a first-class supported service. It supports the `?authuser=N` parameter just like Google services.

- Added to `isGoogleServiceUrl()` and `getAccountForUrl()`
- Added to `allSupportedGoogleServices()` with its own logo
- Added `*://*.youtube.com/*` and `*://*.youtu.be/*` to `host_permissions`
- A simple YouTube logo icon was generated and added to `images/logos/youtube.png`

### Additional Google services
**File:** `utils.js`

Added to the service catalogue:
- Gemini (AI) — `gemini.google.com`
- NotebookLM — `notebooklm.google.com`
- Google Search — `google.com` (the search homepage)
- Scholar — `scholar.google.com`
- Shopping — `shopping.google.com`
- Blogger / Blogspot — `blogger.com`, `*.blogspot.com`
- Books — `books.google.com`
- Flights — `google.com/travel/flights`
- Travel — `google.com/travel`
- Looker — `looker.google.com`

### Custom URL rules
**Files:** `rules.js`, `service-worker.js`

Users can add rules for arbitrary URLs (not just hardcoded Google services). Enter any hostname or pattern (e.g. `myapp.example.com`) and assign a Google account to it. The pattern is matched case-insensitively as a substring of the visited URL.

### Service search/filter
**File:** `rules.js`

A text input above the service dropdown filters the list in real time, making it easier to find a specific service among the 55+ options.

### Import / Export
**Files:** `service-worker.js`, `app.js`

All profiles and their rules can be exported to a JSON file and imported back. Useful for backing up settings or migrating to another browser.

### Enforce account on pre-cached URLs (Behaviour toggle)
**Files:** `utils.js`, `service-worker.js`, `app.js`, `popup.html`, `styles.css`

**Problem:** When a browser autocompletes a URL that already includes `/u/2` or `?authuser=2` (from a previous visit), the extension's early-exit guards skip redirect logic entirely, leaving the user on the wrong account.

**Solution:** Added an opt-in toggle in Settings → Behaviour: "Enforce account on pre-cached URLs". When enabled, any incoming URL that contains `/u/N` or `authuser=N` has those segments stripped before being evaluated against the active profile's rules. The result is then redirected as usual.

When disabled (default), the original behaviour is preserved: URLs that already have `/u/N` or `authuser` are passed through unchanged (fast path, avoids unnecessary redirects).

**Implementation:**
- `DEFAULT_SETTINGS` in `utils.js` defines `enforceOnPrecachedUrls: false`
- `loadSettings()` / `saveSettings()` persist settings under `chrome.storage.sync` key `"settings"` (separate from profiles)
- Service worker holds `_settings` in memory, loaded at startup and on `chrome.storage.onChanged`
- `handleNavigation()` in `service-worker.js` conditionally strips `/u/N` from `pathname` and `authuser` from search params before evaluating rules
- `save_settings` message handler in `service-worker.js` updates `_settings` immediately on save
- Settings tab has a CSS toggle switch wired to `loadSettings()` on open and `save_settings` message on change

### Quick-switch (switch this tab)
**Files:** `app.js`, `popup.html`, `styles.css`

A new always-visible section between the profile bar and the tabs allows changing the Google account on the current browser tab with one click. It detects the current tab URL, determines which account is active, and shows all logged-in accounts as clickable rows. Clicking one immediately redirects the current tab to that account and closes the popup.

This is intentionally separate from the "default account" concept — it's a one-shot override for the current tab only, without changing any profile settings.

If the current tab is not a Google page, a muted message is shown instead.

### Profile switch redirect preference
**Files:** `utils.js`, `app.js`, `popup.html`, `styles.css`

A new `profileSwitchRedirect` setting with three values:
- **Ask** (default): shows the redirect banner with "Redirect tabs" / "Skip" buttons when switching profiles
- **Always**: immediately redirects all open Google tabs on profile switch, no prompt
- **Never**: silently switches profile without redirecting any tabs

The setting is exposed as a segmented control in Settings → Behaviour.

Additionally, when the banner is shown (in "Ask" mode), it includes small "Always redirect" and "Never redirect" link-buttons. Clicking one saves the preference and performs the action — a low-friction way to change the setting without navigating to Settings.

### Redirect cycle detection improvement
**File:** `service-worker.js`

The original implementation tracked the last 4 redirects in a flat array and compared only adjacent entries. The new implementation filters by time window (250 ms) and counts occurrences of the same URL, which is more robust against edge cases.

---

## UI redesign (v3.0)

### Accounts tab removed, merged into profiles
**Files:** `app.js`, `popup.html`, `profiles.js`, `styles.css`

The separate "Accounts" tab has been eliminated. The default account for each profile is now configured directly in the profile edit form (alongside name and color). Profile cards in the Settings tab show the default account email on a meta line.

The account-fetching logic from `accounts.js` has been absorbed into `app.js` (`fetchAndStoreAccounts()`, `openSignInForAccount()`). The file `accounts.js` has been deleted.

### Two-tab layout
**File:** `popup.html`

The popup now has two tabs: **Rules** and **Settings** (down from three). This reduces cognitive load — all configuration is either per-service rules (Rules tab) or global settings/profiles (Settings tab).

---

## Architecture changes

### `app.js` — central orchestrator
Defines `window.App` (global state: profiles, accounts, activeProfileId, viewedProfileId, settings), handles tab navigation, profile bar rendering, quick-switch rendering, profile switching with configurable redirect behaviour, modal open/close, behaviour settings wiring, and import/export. Also contains account-fetching logic (previously in `accounts.js`).

### `profiles.js` — profile CRUD UI
All profile CRUD UI — create, edit, duplicate, delete, activate — both in the Settings tab card list and the profile modal. Profile edit form now includes a default-account picker.

### `utils.js` additions
Profile helper functions: `makeProfile()`, `makeDefaultProfile()`, `resolveRules()`, `loadProfiles()`, `saveProfiles()`, `getActiveProfile()`, `getDefaultProfile()`. Settings helpers: `DEFAULT_SETTINGS`, `loadSettings()`, `saveSettings()`. Constants: `PROFILE_COLORS`, `DEFAULT_PROFILE_ID`.

### `background.js` removed
The original MV2 background script. Fully replaced by `service-worker.js`.

### `accounts.js` removed
Account-fetching and display logic merged into `app.js`.

### `rules.js` — pure UI renderer
Reacts to `App` state via custom events (`app:ready`, `app:profile-switched`, `app:updated`). All writes go through `App.saveProfiles()`.

### Popup HTML structure
- Two tabs (Rules, Settings) instead of three
- Quick-switch section (always visible, collapsible) between profile bar and tabs
- Redirect banner includes "Always redirect" / "Never redirect" inline shortcut buttons
- Settings tab contains: Profiles manager, Behaviour (toggle + segmented control), Import/Export, About
- All scripts loaded at end of `<body>` in dependency order: `utils.js` → `app.js` → `rules.js` → `profiles.js`
