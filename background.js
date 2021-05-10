let defaultAccount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ defaultAccount });
});

chrome.storage.sync.get({ defaultAccount }, (data) => {
  defaultAccount = data.defaultAccount ?? 0;
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("defaultAccount" in changes) {
    defaultAccount = changes["defaultAccount"].newValue;
  }
});

chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
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
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (
      details.url &&
      // filter only get requests from the main_frame (user-initiated)
      details.method === "GET" &&
      details.type === "main_frame" &&
      // test if it's one of the Google services
      isGoogleServiceUrl(details.url) &&
      // test if the URL does not contain "authuser" or "/u/0"
      details.url.toLowerCase().indexOf("authuser") < 0 &&
      !/https?:\/\/.*\.google\.co.*\/u\/\d+/i.test(details.url)
    ) {
      const newArg = "authuser=" + defaultAccount;
      const redirectUrl =
        details.url + (details.url.indexOf("?") < 0 ? "?" : "&") + newArg;
      console.log(
        "webRequest.onBeforeRequest, found URL, redirecting to: ",
        redirectUrl
      );
      return { redirectUrl };
    }
  },
  // filters
  {
    urls: ["<all_urls>"],
  },
  // extraInfoSpec
  ["blocking"]
);
