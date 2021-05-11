let defaultAccount = 0;

chrome.runtime.onInstalled.addListener(() => {
  SyncStorage.store({ defaultAccount });
  SyncStorage.store({ rules: [] });
});

SyncStorage.get("defaultAccount", (data) => {
  defaultAccount = data.defaultAccount ?? 0;
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("defaultAccount" in changes) {
    defaultAccount = changes["defaultAccount"].newValue;
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
      isGoogleServiceUrl(details.url) &&
      (details.type === "main_frame" || details.type === "sub_frame") &&
      details.method === "GET"
    ) {
      console.log("webRequest.onBeforeRequest, details: ", details);
    }

    if (
      details.url &&
      // filter only get requests from the main_frame (user-initiated)
      details.method === "GET" &&
      (details.type === "main_frame" || details.type === "sub_frame") &&
      // test if it's one of the Google services
      isGoogleServiceUrl(details.url)
      // test if the URL does not contain "authuser" or "/u/0"
      // && details.url.toLowerCase().indexOf("authuser") < 0 &&
      // !/https?:\/\/.*\.google\.co.*\/u\/\d+/i.test(details.url)
    ) {
      // return early when user came from one of Google Services (it's most likely the manual account change)
      if (details.initiator && isGoogleServiceUrl(details.initiator)) {
        // TODO: remove log here
        console.log("webRequest.onBeforeRequest, details: ", details);
        console.log("webRequest.onBeforeRequest, NO REDIRECT");
        return;
      }

      const redirectUrl = convertToRedirectUrl(details.url, defaultAccount);
      console.log("webRequest.onBeforeRequest, details: ", details);
      console.log("webRequest.onBeforeRequest, redirectUrl: ", redirectUrl);
      if (redirectUrl) {
        return { redirectUrl };
      }
    }
  },
  // filters
  {
    urls: ["<all_urls>"],
  },
  // extraInfoSpec
  ["blocking"]
);

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
