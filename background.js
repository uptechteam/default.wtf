let defaultAccount = 0;
let rules = [];
let accounts = [];

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == "install") {
    SyncStorage.get("rules", (data) => {
      if (data.rules === undefined) {
        SyncStorage.store({ rules: [] });
      }
    });
    SyncStorage.get("defaultAccount", (data) => {
      if (data.defaultAccount === undefined) {
        SyncStorage.store({ defaultAccount: 0 });
      }
    });
  }
});

// In Manifest V3 (Chrome) the background is a service worker that can be
// stopped and restarted at any time, so the state is reloaded on every start.
const stateLoaded = new Promise((resolve) => {
  SyncStorage.get(["defaultAccount", "rules", "accounts"], (data) => {
    defaultAccount = data.defaultAccount ?? 0;
    rules = data.rules ?? [];
    accounts = data.accounts ?? [];
    resolve();
  });
});

// Manifest V3 has no blocking webRequest, redirects are done with declarativeNetRequest rules
const useDeclarativeNetRequest =
  chrome.runtime.getManifest().manifest_version >= 3 &&
  Boolean(chrome.declarativeNetRequest);

stateLoaded.then(updateRedirectRules);

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("defaultAccount" in changes) {
    defaultAccount = changes["defaultAccount"].newValue;
  }
  if ("rules" in changes) {
    rules = changes["rules"].newValue;
  }
  if ("accounts" in changes) {
    accounts = changes["accounts"].newValue;
  }
  if (
    "defaultAccount" in changes ||
    "rules" in changes ||
    "accounts" in changes
  ) {
    updateRedirectRules();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === "fetch_google_accounts") {
    const url =
      "https://accounts.google.com/ListAccounts?gpsia=1&source=ogb&mo=1&origin=https://accounts.google.com";
    fetch(url, { credentials: "include" })
      .then((response) => response.text())
      .then(function (rawText) {
        // DOMParser is not available in service workers
        const html = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i)[1];
        return html
          .split("'")[1]
          .replace(/\\x([0-9a-fA-F]{2})/g, (match, paren) =>
            String.fromCharCode(parseInt(paren, 16))
          )
          .replace(/\\\//g, "/")
          .replace(/\\n/g, "");
      })
      .then((text) => JSON.parse(text))
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
});

// collect last 4 redirectUrls
let last4RedirectUrls = [];
const maxRedirectTimeMS = 250;

function detectRedirectCycle(redirectUrl) {
  const currentTime = new Date().getTime();
  if (last4RedirectUrls.length === 0) {
    last4RedirectUrls.push({ time: currentTime, redirectUrl });
    return false;
  }
  const lastRedirect = last4RedirectUrls[last4RedirectUrls.length - 1];
  if (currentTime - lastRedirect.time > maxRedirectTimeMS) {
    last4RedirectUrls = [];
  }
  if (lastRedirect.redirectUrl === redirectUrl) {
    last4RedirectUrls.push({ time: currentTime, redirectUrl });
  }
  return last4RedirectUrls.length >= 4;
}

if (!useDeclarativeNetRequest) chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (
      details.url &&
      // filter only get requests from the main_frame (user-initiated)
      details.method === "GET" &&
      // test if it's one of the Google services
      isGoogleServiceUrl(details.url) &&
      // test if the URL does not contain "authuser" or "/u/0"
      details.url.toLowerCase().indexOf("authuser") < 0 &&
      !/https?:\/\/.*\.google\.co.*\/u\/\d+/i.test(details.url)
    ) {
      // Check google service is Docs, do not redirect on document creation
      if (
        details.url.includes("docs.google") &&
        details.url.includes("/create")
      ) {
        return;
      }
      //
      const accountId = getAccountForService(details.url);
      const redirectUrl = convertToRedirectUrl(details.url, accountId);
      // Cos with "0" there are many redirect problems, and Google handles it anyway
      // isAccountLoggedIn - cos there will be ERR_TOO_MANY_REDIRECTS
      if (redirectUrl && accountId !== 0 && isAccountLoggedIn(accountId)) {
        if (detectRedirectCycle(redirectUrl)) return; // ERR_TOO_MENY_REQUESTS (detecting a redirect cycle)
        return { redirectUrl };
      }
    }
  },
  // filters
  {
    // types: ["main_frame", "sub_frame"],
    types: ["main_frame"],
    urls: ["<all_urls>"],
  },
  // extraInfoSpec
  ["blocking"]
);

chrome.tabs.onCreated.addListener(async (tab) => {
  await stateLoaded;
  const url = tab.pendingUrl || tab.url;
  if (!url || !isGoogleServiceUrl(url)) return;
  if (tab.openerTabId) {
    chrome.tabs.get(tab.openerTabId, (openerTab) => {
      if (openerTab && isAnyGoogleUrl(openerTab.url)) return;
      const accountId = getAccountForService(url);
      const redirectUrl = convertToRedirectUrl(url, accountId);
      if (redirectUrl) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      }
    });
  } else {
    const accountId = getAccountForService(url);
    const redirectUrl = convertToRedirectUrl(url, accountId);
    if (redirectUrl) {
      chrome.tabs.update(tab.id, { url: redirectUrl });
    }
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command?.indexOf("switch_to_ga_") >= 0) {
    try {
      const accNum = parseInt(command.charAt(command.length - 1)) - 1;
      SyncStorage.get("accounts", (data) => {
        // redirect only if accNum is not > than totla number of accounts
        if (data.accounts && data.accounts.length > accNum) {
          redirectCurrectTab(accNum);
        }
      });
    } catch {}
  }
});

// checks if the account is logged in (to redirect only logged in Accounts)
function isAccountLoggedIn(accountIndex) {
  return Boolean(accounts[accountIndex]?.isLoggedIn);
}

function getAccountForService(url) {
  for (const rule of rules) {
    const reg = new RegExp(
      `^https?:\/\/[^?&]*${rule.serviceName.toLowerCase()}\.google\.co.*`,
      "is"
    );
    if (reg.test(url)) {
      return rule.accountId;
    }
  }
  return defaultAccount;
}

// Manifest V3: mirror the webRequest redirect logic above with declarativeNetRequest dynamic rules
const RULE_PRIORITY = { defaultAccount: 1, serviceRule: 2, exception: 3 };
const mainFrameGet = { resourceTypes: ["main_frame"], requestMethods: ["get"] };
let redirectRulesUpdate = Promise.resolve();

function authuserRedirect(accountId) {
  return {
    type: "redirect",
    redirect: {
      transform: {
        queryTransform: {
          addOrReplaceParams: [{ key: "authuser", value: `${accountId}` }],
        },
      },
    },
  };
}

// Cos with "0" there are many redirect problems, and Google handles it anyway
// isAccountLoggedIn - cos there will be ERR_TOO_MANY_REDIRECTS
function shouldRedirectTo(accountId) {
  return accountId !== 0 && isAccountLoggedIn(accountId);
}

function buildRedirectRules() {
  const result = [];
  const add = (priority, action, condition) =>
    result.push({
      id: result.length + 1,
      priority,
      action,
      condition: { ...mainFrameGet, isUrlFilterCaseSensitive: false, ...condition },
    });

  // never redirect URLs that already contain "authuser" or "/u/0"
  add(RULE_PRIORITY.exception, { type: "allow" }, { urlFilter: "authuser" });
  add(
    RULE_PRIORITY.exception,
    { type: "allow" },
    { regexFilter: "^https?://.*\\.google\\.co.*/u/[0-9]+" }
  );
  // do not redirect on Docs document creation
  add(
    RULE_PRIORITY.exception,
    { type: "allow" },
    { regexFilter: "docs\\.google.*/create" }
  );

  // rules for specific services
  for (const rule of rules) {
    const action = shouldRedirectTo(rule.accountId)
      ? authuserRedirect(rule.accountId)
      : { type: "allow" };
    add(RULE_PRIORITY.serviceRule, action, {
      regexFilter: `^https?://[^?&]*${rule.serviceName.toLowerCase()}\\.google\\.co.*`,
    });
  }

  // default account for all services
  if (shouldRedirectTo(defaultAccount)) {
    add(RULE_PRIORITY.defaultAccount, authuserRedirect(defaultAccount), {
      requestDomains: GOOGLE_SERVICE_SUBDOMAINS.map((s) => `${s}.google.com`),
    });
    add(RULE_PRIORITY.defaultAccount, authuserRedirect(defaultAccount), {
      regexFilter: `^https?://(www\\.)?google\\.co(m|\\.[a-z]{2,3})/(${GOOGLE_SERVICE_PATHS.join(
        "|"
      )})`,
    });
  }
  return result;
}

function updateRedirectRules() {
  if (!useDeclarativeNetRequest) return;
  // serialize updates, so that rule ids from concurrent updates do not clash
  redirectRulesUpdate = redirectRulesUpdate
    .then(() => chrome.declarativeNetRequest.getDynamicRules())
    .then((existingRules) =>
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map((r) => r.id),
        addRules: buildRedirectRules(),
      })
    )
    .catch((error) => console.error("Failed to update redirect rules", error));
}
