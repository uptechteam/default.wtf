importScripts("utils.js");

// ─── In-memory state ─────────────────────────────────────────────────────────

let _profiles = [];
let _activeProfileId = DEFAULT_PROFILE_ID;
let _accounts = [];
let _settings = { ...DEFAULT_SETTINGS };

function activeProfile() {
  return getActiveProfile(_profiles, _activeProfileId);
}
function defaultProfile() {
  return getDefaultProfile(_profiles);
}

function loadState(cb) {
  loadProfiles((data) => {
    _profiles = data.profiles;
    _activeProfileId = data.activeProfileId;
    _accounts = data.accounts;
    loadSettings((s) => {
      _settings = s;
      if (cb) cb();
    });
  });
}

loadState();

chrome.storage.onChanged.addListener(() => loadState());

// ─── Install ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  SyncStorage.get(["profiles", "activeProfileId"], (data) => {
    const toStore = {};
    if (!data.profiles) {
      toStore.profiles = [makeDefaultProfile()];
    }
    if (!data.activeProfileId) {
      toStore.activeProfileId = DEFAULT_PROFILE_ID;
    }
    if (Object.keys(toStore).length) SyncStorage.store(toStore);
  });
});

// ─── Migrate legacy data (rules / defaultAccount at root) ────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "update") return;
  SyncStorage.get(["rules", "defaultAccount", "customServices", "profiles"], (data) => {
    if (data.profiles) return; // already migrated
    const legacy = makeDefaultProfile();
    if (Array.isArray(data.rules)) legacy.rules = data.rules;
    if (typeof data.defaultAccount === "number") legacy.defaultAccount = data.defaultAccount;
    if (Array.isArray(data.customServices)) legacy.customServices = data.customServices;
    SyncStorage.store({ profiles: [legacy], activeProfileId: DEFAULT_PROFILE_ID });
  });
});

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Fetch Google accounts
  if (message === "fetch_google_accounts") {
    const url = "https://accounts.google.com/ListAccounts?gpsia=1&source=ogb&mo=1&origin=https://accounts.google.com";
    fetch(url)
      .then(r => r.text())
      .then((rawText) => {
        const scriptMatch = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (!scriptMatch) throw new Error("no script");
        const dataStr = scriptMatch[1].split("'")[1];
        if (!dataStr) throw new Error("no data");
        return dataStr
          .replace(/\\x([0-9a-fA-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)))
          .replace(/\\\//g, "/")
          .replace(/\\n/g, "");
      })
      .then(t => JSON.parse(t))
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  // Switch active profile
  if (message?.type === "set_active_profile") {
    const { profileId, redirectTabs, tabIds } = message;
    SyncStorage.store({ activeProfileId: profileId }, () => {
      _activeProfileId = profileId;
      if (redirectTabs) {
        if (tabIds && tabIds.length > 0) {
          redirectSpecificTabs(tabIds);
        } else {
          redirectAllGoogleTabs();
        }
      }
      sendResponse({ success: true });
    });
    return true;
  }

  // Get all open Google tab URLs (so popup can ask user)
  if (message === "get_google_tabs") {
    chrome.tabs.query({}, (tabs) => {
      const googleTabs = tabs.filter(t => t.url && isGoogleServiceUrl(t.url));
      sendResponse(googleTabs.map(t => ({ id: t.id, url: t.url, title: t.title })));
    });
    return true;
  }

  // Export
  if (message === "export_settings") {
    SyncStorage.get(["profiles", "activeProfileId"], (data) => {
      sendResponse({
        version: "2.0",
        exportedAt: new Date().toISOString(),
        profiles: data.profiles ?? [],
        activeProfileId: data.activeProfileId ?? DEFAULT_PROFILE_ID,
      });
    });
    return true;
  }

  // Save behaviour settings
  if (message?.type === "save_settings") {
    saveSettings(message.data, () => {
      _settings = { ...DEFAULT_SETTINGS, ...message.data };
      sendResponse({ success: true });
    });
    return true;
  }

  // Import
  if (message?.type === "import_settings") {
    const s = message.data;
    if (!s || !Array.isArray(s.profiles)) {
      sendResponse({ success: false, error: "Invalid settings file" });
      return true;
    }
    SyncStorage.store({
      profiles: s.profiles,
      activeProfileId: s.activeProfileId ?? DEFAULT_PROFILE_ID,
    }, () => sendResponse({ success: true }));
    return true;
  }
});

// ─── Redirect tabs to active profile ──────────────────────────────────────────

function redirectAllGoogleTabs() {
  const prof = activeProfile();
  const defProf = defaultProfile();
  const resolvedRules = resolveRules(prof, defProf);

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url || !isGoogleServiceUrl(tab.url)) continue;
      const accountId = getAccountForUrl(tab.url, resolvedRules, prof.defaultAccount);
      const redirectUrl = convertToRedirectUrl(tab.url, accountId);
      if (redirectUrl && isAccountLoggedIn(accountId)) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      }
    }
  });
}

function redirectSpecificTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return;
  const prof = activeProfile();
  const defProf = defaultProfile();
  const resolvedRules = resolveRules(prof, defProf);
  const tabIdSet = new Set(tabIds);

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tabIdSet.has(tab.id)) continue;
      if (!tab.url || !isGoogleServiceUrl(tab.url)) continue;
      const accountId = getAccountForUrl(tab.url, resolvedRules, prof.defaultAccount);
      const redirectUrl = convertToRedirectUrl(tab.url, accountId);
      if (redirectUrl && isAccountLoggedIn(accountId)) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      }
    }
  });
}

// ─── Navigation interception ──────────────────────────────────────────────────

let last4Redirects = [];

function detectCycle(url) {
  const now = Date.now();
  last4Redirects = last4Redirects.filter(r => now - r.time < 250);
  if (last4Redirects.filter(r => r.url === url).length >= 3) return true;
  last4Redirects.push({ time: now, url });
  return false;
}

function handleNavigation(tabId, url) {
  if (!isGoogleServiceUrl(url) && !isCustomServiceUrl(url)) return;

  if (_settings.enforceOnPrecachedUrls) {
    // Strip /u/N path segments and authuser params so we re-evaluate from scratch
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(/\/u\/\d+\/?/i, "/");
      u.searchParams.delete("authuser");
      url = u.toString();
    } catch {}
  } else {
    if (/authuser/i.test(url)) return;
    if (/\/u\/\d+/i.test(url)) return;
  }

  if (url.includes("docs.google") && url.includes("/create")) return;

  const prof = activeProfile();
  const defProf = defaultProfile();
  const resolvedRules = resolveRules(prof, defProf);
  const accountId = getAccountForUrl(url, resolvedRules, prof.defaultAccount);
  const redirectUrl = convertToRedirectUrl(url, accountId);

  if (redirectUrl && isAccountLoggedIn(accountId)) {
    if (detectCycle(redirectUrl)) return;
    chrome.tabs.update(tabId, { url: redirectUrl });
  }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  handleNavigation(details.tabId, details.url);
});

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (!command?.startsWith("switch_to_ga_")) return;
  const accNum = parseInt(command.slice(-1)) - 1;
  if (isNaN(accNum)) return;
  if (_accounts.length > accNum) redirectCurrentTab(accNum);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAccountLoggedIn(accountIndex) {
  if (accountIndex === 0) return true;
  return Boolean(_accounts[accountIndex]?.isLoggedIn);
}

function isCustomServiceUrl(url) {
  const prof = activeProfile();
  const defProf = defaultProfile();
  const allCustom = [
    ...(prof.customServices ?? []),
    ...((prof.id !== DEFAULT_PROFILE_ID ? defProf?.customServices : null) ?? []),
  ];
  return allCustom.some(cs => { try { return new RegExp(cs.pattern, "i").test(url); } catch { return false; } });
}

function getAccountForUrl(url, rules, fallbackAccount) {
  for (const rule of rules) {
    if (rule.isCustom && rule.pattern) {
      try { if (new RegExp(rule.pattern, "i").test(url)) return rule.accountId; } catch {}
      continue;
    }
    const name = rule.serviceName?.toLowerCase();
    if (!name) continue;

    if (name === "youtube") {
      if (/^https?:\/\/(www\.)?youtube\.com/i.test(url) || /^https?:\/\/(www\.)?youtu\.be/i.test(url)) return rule.accountId;
      continue;
    }
    if (name === "blogger") {
      if (/^https?:\/\/(www\.)?blogger\.com/i.test(url) || /^https?:\/\/.*\.blogspot\.com/i.test(url)) return rule.accountId;
      continue;
    }
    if (name === "search") {
      if (/^https?:\/\/(www\.)?google\.co(m|\.[a-z]{2,3})\/?(\?|$|#|\/search|\/webhp)/i.test(url)) return rule.accountId;
      continue;
    }

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^https?:\\/\\/[^?&]*${escaped}\\.google\\.co.*`, "is").test(url)) return rule.accountId;
  }
  return fallbackAccount;
}
