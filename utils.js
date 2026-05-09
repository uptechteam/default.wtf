// ─── URL matching ────────────────────────────────────────────────────────────

function isGoogleServiceUrl(url) {
  return (
    /^https?:\/\/[^?&]*(?:mail|drive|calendar|meet|docs|admin|photos|translate|keep|hangouts|chat|workspace|maps|news|ads|ediscovery|jamboard|earth|podcasts|classroom|business|myaccount|adsense|cloud|adwords|analytics|firebase|play|voice|tagmanager|duo|datastudio|optimize|merchants|finance|colab\.research|contacts|script|messages|search|stadia|developers|one|chrome|books|sites|groups|blogger|gemini|notebooklm|looker)\.google\.co.*/i.test(url) ||
    /^https?:\/\/(www\.)?google\.co(?:m|\.[a-z]{2,3})\/(?:maps|finance|travel|flights|shopping|books|scholar)/i.test(url) ||
    /^https?:\/\/(www\.)?youtube\.com/i.test(url) ||
    /^https?:\/\/(www\.)?youtu\.be/i.test(url) ||
    /^https?:\/\/(www\.)?blogger\.com/i.test(url) ||
    /^https?:\/\/.*\.blogspot\.com/i.test(url)
  );
}

function isAnyGoogleUrl(url) {
  return (
    /^https?:\/\/([^?&]*\.)?google\.co.*/i.test(url) ||
    /^https?:\/\/(www\.)?youtube\.com/i.test(url) ||
    /^https?:\/\/(www\.)?blogger\.com/i.test(url)
  );
}

function convertToRedirectUrl(originalUrl, accountId) {
  const url = new URL(originalUrl);
  if (/youtube\.com|youtu\.be/i.test(url.hostname)) return convertAuthUserUrl(url, accountId);
  if (/blogger\.com|blogspot\.com/i.test(url.hostname)) return convertAuthUserUrl(url, accountId);
  return convertAuthUserUrl(url, accountId);
}

function convertAuthUserUrl(url, accountId) {
  const params = new URLSearchParams(url.search);
  if (`${params.get("authuser")}` === `${accountId}`) return null;
  const uMatch = url.href.match(/\/u\/(\d+)\/?/i);
  if (uMatch && uMatch[1] && `${uMatch[1]}` === `${accountId}`) return null;
  params.delete("authuser");
  params.set("authuser", accountId);
  url.search = params.toString();
  return url.toString();
}

function redirectCurrentTab(accountId) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && isGoogleServiceUrl(tabs[0].url)) {
      const url = convertToRedirectUrl(tabs[0].url, accountId);
      if (url) chrome.tabs.update(tabs[0].id, { url });
    }
  });
}

// ─── Service catalogue ───────────────────────────────────────────────────────

function allSupportedGoogleServices() {
  return [
    { name: "YouTube",        title: "YouTube",          url: "youtube.com",                      img: "./images/logos/youtube.png",     category: "media" },
    { name: "Calendar",       title: "Calendar",         url: "calendar.google.com",              img: "./images/logos/calendar.png",    category: "productivity" },
    { name: "Drive",          title: "Drive",            url: "drive.google.com",                 img: "./images/logos/drive.png",       category: "productivity" },
    { name: "Maps",           title: "Maps",             url: "maps.google.com",                  img: "./images/logos/maps.png",        category: "utilities" },
    { name: "Meet",           title: "Meet",             url: "meet.google.com",                  img: "./images/logos/meet.png",        category: "communication" },
    { name: "Mail",           title: "Gmail",            url: "mail.google.com",                  img: "./images/logos/mail.png",        category: "communication" },
    { name: "Docs",           title: "Docs",             url: "docs.google.com",                  img: "./images/logos/docs.png",        category: "productivity" },
    { name: "Admin",          title: "Admin",            url: "admin.google.com",                 img: "./images/logos/admin.png",       category: "admin" },
    { name: "Photos",         title: "Photos",           url: "photos.google.com",                img: "./images/logos/photos.png",      category: "media" },
    { name: "Translate",      title: "Translate",        url: "translate.google.com",             img: "./images/logos/translate.png",   category: "utilities" },
    { name: "Keep",           title: "Keep",             url: "keep.google.com",                  img: "./images/logos/keep.png",        category: "productivity" },
    { name: "Chat",           title: "Chat",             url: "chat.google.com",                  img: "./images/logos/chat.png",        category: "communication" },
    { name: "Gemini",         title: "Gemini (AI)",      url: "gemini.google.com",                img: "./images/logos/google.png",      category: "utilities" },
    { name: "NotebookLM",     title: "NotebookLM",       url: "notebooklm.google.com",            img: "./images/logos/google.png",      category: "productivity" },
    { name: "Search",         title: "Google Search",    url: "google.com",                       img: "./images/logos/search.png",      category: "utilities" },
    { name: "Shopping",       title: "Shopping",         url: "shopping.google.com",              img: "./images/logos/google.png",      category: "utilities" },
    { name: "Scholar",        title: "Scholar",          url: "scholar.google.com",               img: "./images/logos/google.png",      category: "utilities" },
    { name: "News",           title: "News",             url: "news.google.com",                  img: "./images/logos/news.png",        category: "media" },
    { name: "Ads",            title: "Ads",              url: "ads.google.com",                   img: "./images/logos/ads.png",         category: "marketing" },
    { name: "Ediscovery",     title: "Ediscovery (Vault)",url: "ediscovery.google.com",           img: "./images/logos/ediscovery.png",  category: "admin" },
    { name: "Earth",          title: "Earth",            url: "earth.google.com",                 img: "./images/logos/earth.png",       category: "utilities" },
    { name: "Podcasts",       title: "Podcasts",         url: "podcasts.google.com",              img: "./images/logos/podcasts.png",    category: "media" },
    { name: "Classroom",      title: "Classroom",        url: "classroom.google.com",             img: "./images/logos/classroom.png",   category: "productivity" },
    { name: "Business",       title: "Business Profile", url: "business.google.com",              img: "./images/logos/business.png",    category: "marketing" },
    { name: "MyAccount",      title: "My Account",       url: "myaccount.google.com",             img: "./images/logos/google.png",      category: "admin" },
    { name: "Adsense",        title: "AdSense",          url: "adsense.google.com",               img: "./images/logos/adsense.png",     category: "marketing" },
    { name: "Adwords",        title: "AdWords",          url: "adwords.google.com",               img: "./images/logos/ads.png",         category: "marketing" },
    { name: "Cloud",          title: "Cloud Console",    url: "console.cloud.google.com",         img: "./images/logos/cloud.png",       category: "developer" },
    { name: "Analytics",      title: "Analytics",        url: "analytics.google.com",             img: "./images/logos/analytics.png",   category: "marketing" },
    { name: "Firebase",       title: "Firebase Console", url: "console.firebase.google.com",      img: "./images/logos/firebase.png",    category: "developer" },
    { name: "Play",           title: "Google Play",      url: "play.google.com",                  img: "./images/logos/play.png",        category: "media" },
    { name: "Voice",          title: "Voice",            url: "voice.google.com",                 img: "./images/logos/voice.png",       category: "communication" },
    { name: "TagManager",     title: "Tag Manager",      url: "tagmanager.google.com",            img: "./images/logos/tagmanager.png",  category: "marketing" },
    { name: "DataStudio",     title: "Looker Studio",    url: "datastudio.google.com",            img: "./images/logos/datastudio.png",  category: "marketing" },
    { name: "Merchants",      title: "Merchant Center",  url: "merchants.google.com",             img: "./images/logos/merchants.png",   category: "marketing" },
    { name: "Finance",        title: "Finance",          url: "finance.google.com",               img: "./images/logos/finance.png",     category: "utilities" },
    { name: "Collab",         title: "Colab",            url: "colab.research.google.com",        img: "./images/logos/google.png",      category: "developer" },
    { name: "Contacts",       title: "Contacts",         url: "contacts.google.com",              img: "./images/logos/contacts.png",    category: "communication" },
    { name: "Script",         title: "Apps Script",      url: "script.google.com",                img: "./images/logos/script.png",      category: "developer" },
    { name: "Messages",       title: "Messages",         url: "messages.google.com",              img: "./images/logos/messages.png",    category: "communication" },
    { name: "SearchConsole",  title: "Search Console",   url: "search.google.com",                img: "./images/logos/search.png",      category: "developer" },
    { name: "Developers",     title: "Developers",       url: "developers.google.com",            img: "./images/logos/developers.png",  category: "developer" },
    { name: "One",            title: "Google One",       url: "one.google.com",                   img: "./images/logos/one.png",         category: "utilities" },
    { name: "ChromeWebStore", title: "Chrome Web Store", url: "chrome.google.com",                img: "./images/logos/chrome.png",      category: "utilities" },
    { name: "Sites",          title: "Sites",            url: "sites.google.com",                 img: "./images/logos/sites.png",       category: "productivity" },
    { name: "Groups",         title: "Groups",           url: "groups.google.com",                img: "./images/logos/groups.png",      category: "communication" },
    { name: "Blogger",        title: "Blogger",          url: "blogger.com",                      img: "./images/logos/google.png",      category: "media" },
    { name: "Workspace",      title: "Workspace",        url: "workspace.google.com",             img: "./images/logos/google.png",      category: "admin" },
    { name: "Hangouts",       title: "Hangouts",         url: "hangouts.google.com",              img: "./images/logos/hangouts.png",    category: "communication" },
    { name: "Jamboard",       title: "Jamboard",         url: "jamboard.google.com",              img: "./images/logos/jamboard.png",    category: "productivity" },
    { name: "Duo",            title: "Duo",              url: "duo.google.com",                   img: "./images/logos/duo.png",         category: "communication" },
    { name: "Stadia",         title: "Stadia",           url: "stadia.google.com",                img: "./images/logos/stadia.png",      category: "media" },
    { name: "Optimize",       title: "Optimize",         url: "optimize.google.com",              img: "./images/logos/optimize.png",    category: "marketing" },
    { name: "Books",          title: "Books",            url: "books.google.com",                 img: "./images/logos/google.png",      category: "media" },
    { name: "Flights",        title: "Flights",          url: "google.com/travel/flights",        img: "./images/logos/google.png",      category: "utilities" },
    { name: "Travel",         title: "Travel",           url: "google.com/travel",                img: "./images/logos/google.png",      category: "utilities" },
    { name: "Looker",         title: "Looker",           url: "looker.google.com",                img: "./images/logos/google.png",      category: "developer" },
  ];
}

// ─── Profile helpers ─────────────────────────────────────────────────────────

const DEFAULT_PROFILE_ID = "default";

const PROFILE_COLORS = [
  "#d66d58", "#4a90d9", "#5cb85c", "#9b59b6",
  "#e67e22", "#1abc9c", "#e91e63", "#607d8b",
];

function makeProfile(name, color, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name,
    color: color ?? PROFILE_COLORS[0],
    defaultAccount: 0,
    rules: [],
    customServices: [],
    ...overrides,
  };
}

function makeDefaultProfile() {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    color: "#8b8792",
    defaultAccount: 0,
    rules: [],
    customServices: [],
  };
}

// Resolve rules for a profile with inheritance from Default.
// Returns merged rule list: profile rules take precedence over default rules
// for the same serviceUrl.
function resolveRules(profile, defaultProfile) {
  if (!defaultProfile || profile.id === DEFAULT_PROFILE_ID) return profile.rules;
  const profileUrls = new Set(profile.rules.map(r => r.serviceUrl));
  const inherited = (defaultProfile.rules ?? [])
    .filter(r => !profileUrls.has(r.serviceUrl))
    .map(r => ({ ...r, _inherited: true }));
  return [...profile.rules, ...inherited];
}

// ─── Storage ─────────────────────────────────────────────────────────────────

class SyncStorage {
  static store(obj, callback) {
    chrome.storage.sync.set(obj, callback);
  }
  static get(key, callback) {
    chrome.storage.sync.get(key, callback);
  }
}

// Load profiles + activeProfileId; guarantee Default always exists.
function loadProfiles(callback) {
  SyncStorage.get(["profiles", "activeProfileId", "accounts"], (data) => {
    let profiles = data.profiles ?? [];
    let activeProfileId = data.activeProfileId ?? DEFAULT_PROFILE_ID;

    if (!profiles.find(p => p.id === DEFAULT_PROFILE_ID)) {
      profiles = [makeDefaultProfile(), ...profiles];
    }
    if (!profiles.find(p => p.id === activeProfileId)) {
      activeProfileId = DEFAULT_PROFILE_ID;
    }

    callback({
      profiles,
      activeProfileId,
      accounts: data.accounts ?? [],
    });
  });
}

function saveProfiles(profiles, callback) {
  SyncStorage.store({ profiles }, callback);
}

function getActiveProfile(profiles, activeProfileId) {
  return profiles.find(p => p.id === activeProfileId) ?? profiles[0];
}

function getDefaultProfile(profiles) {
  return profiles.find(p => p.id === DEFAULT_PROFILE_ID);
}

// ─── Global settings (independent of profiles) ───────────────────────────────

const DEFAULT_SETTINGS = {
  enforceOnPrecachedUrls: true,
  profileSwitchRedirect: "ask", // "ask" | "always" | "never"
};

function loadSettings(callback) {
  SyncStorage.get("settings", (data) => {
    callback({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
  });
}

function saveSettings(settings, callback) {
  SyncStorage.store({ settings }, callback);
}
