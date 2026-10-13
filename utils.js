// Shared between the background script (Chrome service worker / Firefox background page) and the popup.

// Google services the extension handles.
// - hosts: service subdomains, e.g. "mail" matches mail.google.com, mail.google.co.uk, ...
// - paths: services that live under www.google.com, e.g. "maps" matches www.google.com/maps
// - hidden: handled by the default account, but not offered in the "Rules" picker
// Full list of Google Services subdomains - https://gist.github.com/abuvanth/b9fcbaf7c77c2954f96c6e556138ffe8
const GOOGLE_SERVICES = [
  { name: "Mail", title: "Gmail", url: "mail.google.com", hosts: ["mail"], img: "mail" },
  { name: "Calendar", title: "Calendar", url: "calendar.google.com", hosts: ["calendar"], img: "calendar" },
  { name: "Drive", title: "Drive", url: "drive.google.com", hosts: ["drive"], img: "drive" },
  { name: "Docs", title: "Docs, Sheets & Slides", url: "docs.google.com", hosts: ["docs"], img: "docs" },
  { name: "Meet", title: "Meet", url: "meet.google.com", hosts: ["meet"], img: "meet" },
  { name: "Chat", title: "Chat", url: "chat.google.com", hosts: ["chat"], img: "chat" },
  { name: "Maps", title: "Maps", url: "maps.google.com", hosts: ["maps"], paths: ["maps"], img: "maps" },
  { name: "Photos", title: "Photos", url: "photos.google.com", hosts: ["photos"], img: "photos" },
  { name: "Keep", title: "Keep", url: "keep.google.com", hosts: ["keep"], img: "keep" },
  { name: "Contacts", title: "Contacts", url: "contacts.google.com", hosts: ["contacts"], img: "contacts" },
  { name: "Admin", title: "Admin", url: "admin.google.com", hosts: ["admin"], img: "admin" },
  { name: "Ads", title: "Ads", url: "ads.google.com", hosts: ["ads"], img: "ads" },
  { name: "Adwords", title: "Adwords", url: "adwords.google.com", hosts: ["adwords"], img: "ads" },
  { name: "Adsense", title: "AdSense", url: "adsense.google.com", hosts: ["adsense"], img: "adsense" },
  { name: "Analytics", title: "Analytics", url: "analytics.google.com", hosts: ["analytics"], img: "analytics" },
  { name: "Script", title: "Apps Script", url: "script.google.com", hosts: ["script"], img: "script" },
  { name: "Business", title: "Business Profile", url: "business.google.com", hosts: ["business"], img: "business" },
  { name: "Chrome", title: "Chrome Web Store", url: "chrome.google.com", hosts: ["chrome"], img: "chrome" },
  { name: "Classroom", title: "Classroom", url: "classroom.google.com", hosts: ["classroom"], img: "classroom" },
  { name: "Cloud", title: "Cloud Console", url: "console.cloud.google.com", hosts: ["cloud"], img: "cloud" },
  { name: "Colab", title: "Colab", url: "colab.research.google.com", hosts: ["colab.research"], img: "collab" },
  { name: "DataStudio", title: "Looker Studio", url: "datastudio.google.com", hosts: ["datastudio", "lookerstudio"], img: "datastudio" },
  { name: "Developers", title: "Developers", url: "developers.google.com", hosts: ["developers"], img: "developers" },
  { name: "Duo", title: "Duo", url: "duo.google.com", hosts: ["duo"], img: "duo" },
  { name: "Earth", title: "Earth", url: "earth.google.com", hosts: ["earth"], img: "earth" },
  { name: "Ediscovery", title: "Vault (eDiscovery)", url: "ediscovery.google.com", hosts: ["ediscovery"], img: "ediscovery" },
  { name: "Finance", title: "Finance", url: "finance.google.com", hosts: ["finance"], paths: ["finance"], img: "finance" },
  { name: "Firebase", title: "Firebase Console", url: "console.firebase.google.com", hosts: ["firebase"], img: "firebase" },
  { name: "Groups", title: "Groups", url: "groups.google.com", hosts: ["groups"], img: "groups" },
  { name: "Hangouts", title: "Hangouts", url: "hangouts.google.com", hosts: ["hangouts"], img: "hangouts" },
  { name: "Jamboard", title: "Jamboard", url: "jamboard.google.com", hosts: ["jamboard"], img: "jamboard" },
  { name: "Merchants", title: "Merchant Center", url: "merchants.google.com", hosts: ["merchants"], img: "merchants" },
  { name: "Messages", title: "Messages", url: "messages.google.com", hosts: ["messages"], img: "messages" },
  { name: "MyAccount", title: "My Account", url: "myaccount.google.com", hosts: ["myaccount"], img: "google" },
  { name: "News", title: "News", url: "news.google.com", hosts: ["news"], img: "news" },
  { name: "One", title: "Google One", url: "one.google.com", hosts: ["one"], img: "one" },
  { name: "Optimize", title: "Optimize", url: "optimize.google.com", hosts: ["optimize"], img: "optimize" },
  { name: "Play", title: "Google Play", url: "play.google.com", hosts: ["play"], img: "play" },
  { name: "Podcasts", title: "Podcasts", url: "podcasts.google.com", hosts: ["podcasts"], img: "podcasts" },
  { name: "SearchConsole", title: "Search Console", url: "search.google.com", hosts: ["search"], img: "search" },
  { name: "Sites", title: "Sites", url: "sites.google.com", hosts: ["sites"], img: "sites" },
  { name: "Stadia", title: "Stadia", url: "stadia.google.com", hosts: ["stadia"], img: "stadia" },
  { name: "TagManager", title: "Tag Manager", url: "tagmanager.google.com", hosts: ["tagmanager"], img: "tagmanager" },
  { name: "Translate", title: "Translate", url: "translate.google.com", hosts: ["translate"], img: "translate" },
  { name: "Voice", title: "Voice", url: "voice.google.com", hosts: ["voice"], img: "voice" },
  { name: "Workspace", title: "Workspace", url: "workspace.google.com", hosts: ["workspace"], img: "google" },
  { name: "Books", title: "Books", url: "books.google.com", hosts: ["books"], img: "google", hidden: true },
  { name: "Travel", title: "Travel", url: "www.google.com/travel", paths: ["travel", "flights"], img: "google", hidden: true },
].map((service) => ({ ...service, img: `./images/logos/${service.img}.png` }));

// google.com, google.co.uk, google.com.ua, google.de, ...
const GOOGLE_TLD = "google\\.(?:com|co\\.[a-z]{2}|com\\.[a-z]{2}|[a-z]{2})";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Regex sources are RE2 compatible, so the same patterns are used for declarativeNetRequest rules.
function serviceRegexSources(service) {
  const sources = [];
  if (service.hosts) {
    sources.push(
      `^https?://(?:[^/?#]*\\.)?(?:${service.hosts.map(escapeRegex).join("|")})\\.${GOOGLE_TLD}(?::[0-9]+)?(?:[/?#]|$)`
    );
  }
  if (service.paths) {
    sources.push(
      `^https?://(?:www\\.)?${GOOGLE_TLD}(?::[0-9]+)?/(?:${service.paths.map(escapeRegex).join("|")})(?:[/?#]|$)`
    );
  }
  return sources;
}

const serviceMatchers = GOOGLE_SERVICES.map((service) => ({
  service,
  regexes: serviceRegexSources(service).map((s) => new RegExp(s, "i")),
}));

// URLs that must never be redirected
const NO_REDIRECT_REGEX_SOURCES = [
  // the account is already chosen: "/u/1/" in the path
  "^https?://[^?#]*/u/[0-9]+(?:[/?#]|$)",
  // document creation - redirecting loses the new document
  `^https?://docs\\.${GOOGLE_TLD}/[^?#]*/create`,
];
const noRedirectRegexes = NO_REDIRECT_REGEX_SOURCES.map((s) => new RegExp(s, "i"));

function getGoogleService(url) {
  if (!url) return null;
  const match = serviceMatchers.find((m) => m.regexes.some((r) => r.test(url)));
  return match ? match.service : null;
}

function isGoogleServiceUrl(url) {
  return Boolean(getGoogleService(url));
}

function isAnyGoogleUrl(url) {
  return /^https?:\/\/([^/?#]*\.)?google\.[a-z.]+(?::[0-9]+)?(?:[/?#]|$)/i.test(url || "");
}

// the account is already chosen in the URL ("authuser" anywhere, or "/u/{num}/")
function isRedirectExcluded(url) {
  return (
    url.toLowerCase().indexOf("authuser") >= 0 ||
    noRedirectRegexes.some((r) => r.test(url))
  );
}

// Converts the URL so that it opens with the given account.
// "/u/{num}/" in the path is replaced, otherwise "?authuser={num}" is set.
// Returns null if the URL is already for that account.
function convertToRedirectUrl(originalUrl, accountIndex) {
  const url = new URL(originalUrl);
  const uMatch = url.pathname.match(/\/u\/(\d+)(?=\/|$)/i);
  if (uMatch) {
    if (uMatch[1] === `${accountIndex}`) return null;
    url.pathname = url.pathname.replace(uMatch[0], `/u/${accountIndex}`);
    url.searchParams.delete("authuser");
    return url.toString();
  }
  if (url.searchParams.get("authuser") === `${accountIndex}`) return null;
  url.searchParams.set("authuser", accountIndex);
  return url.toString();
}

// Account rules are stored with the account email, because account indexes change
// when the user signs in/out. Returns the account index to use, or null.
function resolveAccountIndex(accounts, email, fallbackIndex) {
  if (email && accounts.length) {
    const account = accounts.find((a) => a.email === email);
    return account && account.isLoggedIn ? account.index : null;
  }
  const account = accounts.find((a) => a.index === fallbackIndex);
  return account && account.isLoggedIn ? account.index : null;
}

function getServiceByUrl(serviceUrl) {
  return GOOGLE_SERVICES.find((s) => s.url === serviceUrl) || null;
}

// The account index for a service: its rule if there is one, the default account otherwise
function getAccountIndexForService(service, state) {
  const rule = state.rules.find((r) => r.serviceUrl === service.url);
  if (rule) return resolveAccountIndex(state.accounts, rule.accountEmail, rule.accountId);
  return resolveAccountIndex(state.accounts, state.defaultAccountEmail, state.defaultAccount);
}

function switchTabToAccount(tab, accountIndex) {
  if (!tab || !isGoogleServiceUrl(tab.url)) return;
  const url = convertToRedirectUrl(tab.url, accountIndex);
  if (url) chrome.tabs.update(tab.id, { url });
}

function redirectCurrentTab(accountIndex) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
    switchTabToAccount(tabs && tabs[0], accountIndex)
  );
}

// Settings are synced between devices, the signed in accounts are specific to this browser.
class SyncStorage {
  static store(obj, callback) {
    chrome.storage.sync.set(obj, callback);
  }

  static get(key, callback) {
    chrome.storage.sync.get(key, callback);
  }
}

class LocalStorage {
  static store(obj, callback) {
    chrome.storage.local.set(obj, callback);
  }

  static get(key, callback) {
    chrome.storage.local.get(key, callback);
  }
}
