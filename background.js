// In Manifest V3 (Chrome) the background is a service worker that can be
// stopped and restarted at any time, so the state is reloaded on every start.
const state = {
  enabled: true,
  defaultAccount: 0,
  defaultAccountEmail: undefined,
  rules: [],
  accounts: [],
};

const stateLoaded = new Promise((resolve) => {
  SyncStorage.get(["enabled", "defaultAccount", "defaultAccountEmail", "rules", "accounts"], (sync) => {
    LocalStorage.get("accounts", (local) => {
      state.enabled = sync.enabled ?? true;
      state.defaultAccount = sync.defaultAccount ?? 0;
      state.defaultAccountEmail = sync.defaultAccountEmail;
      state.rules = sync.rules ?? [];
      // accounts used to be stored in sync storage
      state.accounts = local.accounts ?? sync.accounts ?? [];
      resolve();
    });
  });
});

// Manifest V3 has no blocking webRequest, redirects are done with declarativeNetRequest rules
const useDeclarativeNetRequest =
  chrome.runtime.getManifest().manifest_version >= 3 &&
  Boolean(chrome.declarativeNetRequest);

const ACCOUNTS_URL =
  "https://accounts.google.com/ListAccounts?gpsia=1&source=ogb&mo=1&origin=https://accounts.google.com";
const ACCOUNTS_REFRESH_MINUTES = 15;

// no need to store the defaults on install, missing settings fall back to them
chrome.runtime.onInstalled.addListener(() => {
  // accounts used to be synced between devices, but they are specific to this browser
  chrome.storage.sync.remove("accounts");
});

stateLoaded.then(() => {
  updateRedirectRules();
  refreshAccounts();
});

// keep the signed in accounts up to date, so that we don't redirect to a signed out account
if (chrome.alarms) {
  chrome.alarms.create("refresh_accounts", { periodInMinutes: ACCOUNTS_REFRESH_MINUTES });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "refresh_accounts") refreshAccounts();
  });
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  // a change can wake up the service worker, apply it after the stored state is loaded,
  // otherwise the state that is being loaded overwrites it
  await stateLoaded;
  if (area === "local" && "accounts" in changes) {
    state.accounts = changes.accounts.newValue ?? [];
  }
  if (area === "sync") {
    for (const key of ["enabled", "defaultAccount", "defaultAccountEmail", "rules"]) {
      if (key in changes) state[key] = changes[key].newValue;
    }
    state.enabled = state.enabled ?? true;
    state.rules = state.rules ?? [];
  }
  updateRedirectRules();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === "fetch_google_accounts") {
    refreshAccounts().then(sendResponse);
    return true;
  }
});

// Fetches the accounts signed in to this browser and saves them.
// Resolves with the accounts, or null if they could not be fetched.
function refreshAccounts() {
  return fetch(ACCOUNTS_URL, { credentials: "include" })
    .then((response) => response.text())
    .then((rawText) => {
      const accounts = parseAccountsResponse(rawText);
      if (!accounts) {
        // the response format changed, log its shape (without personal data) for debugging
        console.warn("Unexpected Google accounts response", describeAccountsResponse(rawText));
        return null;
      }
      return new Promise((resolve) => LocalStorage.store({ accounts }, () => resolve(accounts)));
    })
    .catch((error) => {
      console.warn("Failed to fetch Google accounts", error);
      return null;
    });
}

// The URL to redirect to, or null if the URL should be opened as is
function getRedirectUrl(url) {
  if (!state.enabled || !url || isRedirectExcluded(url)) return null;
  const service = getGoogleService(url);
  if (!service) return null;
  const accountIndex = getAccountIndexForService(service, state);
  // Cos with "0" there are many redirect problems, and Google handles it anyway
  // signed out accounts - cos there will be ERR_TOO_MANY_REDIRECTS
  if (accountIndex === null || accountIndex === 0) return null;
  return convertToRedirectUrl(url, accountIndex);
}

// collect last 4 redirectUrls
let lastRedirects = [];
const maxRedirectTimeMS = 250;

function detectRedirectCycle(redirectUrl) {
  const currentTime = Date.now();
  lastRedirects = lastRedirects.filter(
    (r) => r.redirectUrl === redirectUrl && currentTime - r.time <= maxRedirectTimeMS
  );
  lastRedirects.push({ time: currentTime, redirectUrl });
  return lastRedirects.length >= 4;
}

// Manifest V2 (Firefox)
if (!useDeclarativeNetRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      // filter only get requests (user-initiated)
      if (details.method !== "GET") return;
      const redirectUrl = getRedirectUrl(details.url);
      if (redirectUrl && !detectRedirectCycle(redirectUrl)) {
        return { redirectUrl };
      }
    },
    { types: ["main_frame"], urls: ["<all_urls>"] },
    ["blocking"]
  );
}

// force redirect of new tabs, which are not opened from Google services
chrome.tabs.onCreated.addListener(async (tab) => {
  await stateLoaded;
  if (!isGoogleServiceUrl(tab.pendingUrl || tab.url)) return;
  if (tab.openerTabId) {
    const openerTab = await new Promise((resolve) =>
      chrome.tabs.get(tab.openerTabId, (t) => resolve(chrome.runtime.lastError ? null : t))
    );
    if (openerTab && isAnyGoogleUrl(openerTab.url)) return;
  }
  // the request could be already redirected, get the latest URL
  chrome.tabs.get(tab.id, (current) => {
    if (chrome.runtime.lastError || !current) return;
    const redirectUrl = getRedirectUrl(current.pendingUrl || current.url);
    if (redirectUrl) chrome.tabs.update(tab.id, { url: redirectUrl });
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (!command || !command.startsWith("switch_to_ga_")) return;
  await stateLoaded;
  const accNum = parseInt(command.charAt(command.length - 1)) - 1;
  const account = state.accounts.filter((a) => a.isLoggedIn)[accNum];
  // redirect only if there is such signed in account
  if (account) redirectCurrentTab(account.index);
});

// Manifest V3 (Chrome): the same redirect logic as getRedirectUrl, as declarativeNetRequest dynamic rules
const EXCLUSION_PRIORITY = 2;
const REDIRECT_PRIORITY = 1;
let redirectRulesUpdate = Promise.resolve();

function buildRedirectRules() {
  const result = [];
  if (!state.enabled) return result;
  const add = (priority, action, condition) =>
    result.push({
      id: result.length + 1,
      priority,
      action,
      condition: {
        resourceTypes: ["main_frame"],
        requestMethods: ["get"],
        isUrlFilterCaseSensitive: false,
        ...condition,
      },
    });

  // never redirect URLs where the account is already chosen
  add(EXCLUSION_PRIORITY, { type: "allow" }, { urlFilter: "authuser" });
  for (const regexFilter of NO_REDIRECT_REGEX_SOURCES) {
    add(EXCLUSION_PRIORITY, { type: "allow" }, { regexFilter });
  }

  for (const service of GOOGLE_SERVICES) {
    const accountIndex = getAccountIndexForService(service, state);
    if (accountIndex === null || accountIndex === 0) continue;
    const action = {
      type: "redirect",
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [{ key: "authuser", value: `${accountIndex}` }],
          },
        },
      },
    };
    for (const regexFilter of serviceRegexSources(service)) {
      add(REDIRECT_PRIORITY, action, { regexFilter });
    }
  }
  return result;
}

function updateRedirectRules() {
  if (!useDeclarativeNetRequest) return;
  // serialize updates, so that rule ids from concurrent updates do not clash
  redirectRulesUpdate = redirectRulesUpdate
    .then(() => stateLoaded)
    .then(() => chrome.declarativeNetRequest.getDynamicRules())
    .then((existingRules) =>
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map((r) => r.id),
        addRules: buildRedirectRules(),
      })
    )
    .catch((error) => console.error("Failed to update redirect rules", error));
}
