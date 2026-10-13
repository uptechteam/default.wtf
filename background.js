// In Manifest V3 (Chrome) the background is a service worker that can be
// stopped and restarted at any time, so the state is reloaded on every start.
const state = {
  enabled: true,
  toolbarIcon: "avatar",
  defaultAccount: 0,
  defaultAccountEmail: undefined,
  rules: [],
  accounts: [],
};

const stateLoaded = new Promise((resolve) => {
  SyncStorage.get(["enabled", "toolbarIcon", "defaultAccount", "defaultAccountEmail", "rules", "accounts"], (sync) => {
    LocalStorage.get("accounts", (local) => {
      state.enabled = sync.enabled ?? true;
      state.toolbarIcon = sync.toolbarIcon ?? "avatar";
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
  updateAllBadges();
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
    for (const key of ["enabled", "toolbarIcon", "defaultAccount", "defaultAccountEmail", "rules"]) {
      if (key in changes) state[key] = changes[key].newValue;
    }
    state.enabled = state.enabled ?? true;
    state.rules = state.rules ?? [];
  }
  updateRedirectRules();
  updateAllBadges();
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

// Toolbar icon: the avatar and/or the number of the account the current Google tab is opened with
const actionApi = chrome.action || chrome.browserAction;
const BADGE_COLORS = ["#4285f4", "#d66d58", "#1e8e3e", "#a142f4", "#e37400", "#12b5cb", "#e52592", "#5f6368", "#b06000"];
const DEFAULT_TITLE = chrome.runtime.getManifest().name;
const DEFAULT_ICON = { 16: "/images/16.png", 32: "/images/32.png" };
const ignoreError = () => void chrome.runtime.lastError;
const iconCache = new Map();
const tabIconKeys = new Map(); // the latest icon requested for a tab, to ignore outdated async results

async function loadAvatar(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

// a round avatar with a colored ring, or the account's initial when there is no avatar
async function drawAccountIcon(account, index) {
  if (typeof OffscreenCanvas === "undefined") throw new Error("OffscreenCanvas is not supported");
  const avatar = await loadAvatar(account && account.profileUrl);
  const color = BADGE_COLORS[index % BADGE_COLORS.length];
  const label = account && (account.name || account.email);
  const letter = (typeof label === "string" && label.trim() ? label.trim() : `${index + 1}`).charAt(0).toUpperCase();
  const imageData = {};
  for (const size of [16, 32]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    if (avatar) {
      const inset = size / 16 + 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - inset, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(avatar, inset, inset, size - 2 * inset, size - 2 * inset);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(size * 0.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, r, r + size * 0.05);
    }
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

function accountIcon(account, index) {
  const key = `${index}|${account ? account.email : ""}|${account ? account.profileUrl : ""}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      drawAccountIcon(account, index).catch((error) => {
        console.warn("Failed to draw the account icon, showing the number instead", error);
        return null;
      })
    );
  }
  return iconCache.get(key);
}

async function updateBadge(tab) {
  if (!actionApi || !tab || tab.id === undefined || tab.id < 0) return;
  const tabId = tab.id;
  const url = tab.url || tab.pendingUrl;
  const service = getGoogleService(url);
  const index = service ? getAccountIndexFromUrl(url, state.accounts) : null;
  const account = index === null ? null : state.accounts.find((a) => a.index === index);
  const style = state.toolbarIcon || "avatar"; // "avatar" | "number" | "both"

  let title = state.enabled ? DEFAULT_TITLE : `${DEFAULT_TITLE} (paused)`;
  if (index !== null) {
    title = `${service.title}: ${account ? account.email : "account"} (#${index + 1})`;
  }
  actionApi.setTitle({ tabId, title }, ignoreError);

  const key = `${url}|${index}|${style}|${account ? account.profileUrl : ""}`;
  tabIconKeys.set(tabId, key);
  const icon = index !== null && style !== "number" ? await accountIcon(account, index) : null;
  if (tabIconKeys.get(tabId) !== key) return; // the tab changed meanwhile

  if (icon) actionApi.setIcon({ tabId, imageData: icon }, ignoreError);
  else actionApi.setIcon({ tabId, path: DEFAULT_ICON }, ignoreError);

  // the number, also when the avatar could not be drawn
  const showNumber = index !== null && (style !== "avatar" || !icon);
  if (showNumber) {
    actionApi.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[index % BADGE_COLORS.length] }, ignoreError);
    if (actionApi.setBadgeTextColor) actionApi.setBadgeTextColor({ tabId, color: "#ffffff" }, ignoreError);
  }
  actionApi.setBadgeText({ tabId, text: showNumber ? `${index + 1}` : "" }, ignoreError);
}

function updateAllBadges() {
  chrome.tabs.query({}, (tabs) => (tabs || []).forEach(updateBadge));
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  await stateLoaded;
  updateBadge(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => tabIconKeys.delete(tabId));
