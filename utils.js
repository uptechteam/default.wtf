// Full list of Google Services subdomains - https://gist.github.com/abuvanth/b9fcbaf7c77c2954f96c6e556138ffe8
function isGoogleServiceUrl(url) {
  return /https?:\/\/.*(?:mail|drive|calendar|meet|docs|admin|photos|translate|keep|hangouts|chat|currents|maps|news|ads|ediscovery|jamboard|earth|travel|podcasts|classroom|business|myaccount|adsense|cloud|adwords|analytics)\.google\.co.*/i.test(
    url
  );
}

function redirectCurrectTab(defaultAccount) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && isGoogleServiceUrl(tabs[0].url)) {
      const url = new URL(tabs[0].url);
      const params = new URLSearchParams(url.search);
      // check if current user is not the same (?authuser={num} or /u/{num}/)
      if (`${params.get("authuser")}` === `${defaultAccount}`) return;
      const uMatch = tabs[0].url.match(/\/u\/(\d+)\//i);
      if (uMatch && uMatch[1] && `${uMatch[1]}` === `${defaultAccount}`) return;

      // current user is different, reload
      params.delete("authuser");
      params.set("authuser", defaultAccount);
      url.search = params.toString();
      chrome.tabs.update(tabs[0].id, { url: url.toString() });
    }
  });
}
