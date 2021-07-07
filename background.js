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

SyncStorage.get("defaultAccount", (data) => {
  defaultAccount = data.defaultAccount ?? 0;
});

SyncStorage.get("rules", (data) => {
  rules = data.rules ?? [];
});

SyncStorage.get("accounts", (data) => {
  accounts = data.accounts ?? [];
});

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
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === "fetch_google_accounts") {
    const url =
      "https://accounts.google.com/ListAccounts?gpsia=1&source=ogb&mo=1&origin=https://accounts.google.com";
    fetch(url)
      .then((response) => response.text())
      .then(function (rawText) {
        const parser = new DOMParser();
        const html = parser
          .parseFromString(rawText, "application/xml")
          .querySelector("script").innerHTML;
        return html
          .split("'")[1]
          .replace(/\\x([0-9a-fA-F]{2})/g, (match, paren) =>
            String.fromCharCode(parseInt(paren, 16))
          )
          .replace(/\\\//g, "/")
          .replace(/\\n/g, "");
      })
      .then((text) => JSON.parse(text))
      .then(sendResponse);
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

chrome.webRequest.onBeforeRequest.addListener(
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

chrome.tabs.onCreated.addListener((tab) => {
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
