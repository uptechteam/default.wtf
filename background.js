let defaultAccount = 0;
let rules = [];

SyncStorage.get("defaultAccount", (data) => {
  defaultAccount = data.defaultAccount ?? 0;
});

SyncStorage.get("rules", (data) => {
  rules = data.rules ?? [];
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("defaultAccount" in changes) {
    defaultAccount = changes["defaultAccount"].newValue;
  }
  if ("rules" in changes) {
    rules = changes["rules"].newValue;
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
      const accountId =
        getAccountForService(details.url, rules) ?? defaultAccount;
      const redirectUrl = convertToRedirectUrl(details.url, accountId);
      // Cos with "0" there are many redirect problems, and Google handles it anyway
      if (redirectUrl && accountId !== 0) {
        console.log("webRequest.onBeforeRequest, redirectUrl: ", redirectUrl);
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
      const accountId =
        getAccountForService(openerTab.url, rules) ?? defaultAccount;
      const redirectUrl = convertToRedirectUrl(url, accountId);
      if (redirectUrl) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      }
    });
  } else {
    const accountId =
      getAccountForService(openerTab.url, rules) ?? defaultAccount;
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
