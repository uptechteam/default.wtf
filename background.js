let defaultAccount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ defaultAccount });
  console.log(`Default Account set to ${defaultAccount}`);
});

chrome.storage.sync.get({ defaultAccount }, (data) => {
  // TODO: need to call this update every time default account updates
  defaultAccount = data.defaultAccount ?? 0;
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
      // test if it's one of the Google services
      /https?:\/\/.*\.google\.co.*/i.test(details.url) &&
      details.method === "GET" &&
      // test if the URL does not contain "authuser" or "/u/0"
      details.url.toLowerCase().indexOf("authuser") < 0 &&
      !/https?:\/\/.*\.google\.co.*\/u\/\d+/i.test(details.url)
    ) {
      const newArg = "authuser=" + defaultAccount;
      var redirectUrl =
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
    urls: ["*://*.google.com/*"],
  },
  // extraInfoSpec
  ["blocking"]
);
