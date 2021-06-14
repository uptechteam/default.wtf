// Full list of Google Services subdomains - https://gist.github.com/abuvanth/b9fcbaf7c77c2954f96c6e556138ffe8
function isGoogleServiceUrl(url) {
  return /^https?:\/\/[^?&]*(?:mail|drive|calendar|meet|docs|admin|photos|translate|keep|hangouts|chat|workspace|maps|news|ads|ediscovery|jamboard|earth|podcasts|classroom|business|myaccount|adsense|cloud|adwords|analytics|firebase|play)\.google\.co.*/i.test(
    url
  );
}

function isAnyGoogleUrl(url) {
  return /^https?:\/\/([^?&]*\.)?google\.co.*/i.test(url);
}

function redirectCurrectTab(defaultAccount) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && isGoogleServiceUrl(tabs[0].url)) {
      const url = convertToRedirectUrl(tabs[0].url, defaultAccount);
      if (url) {
        chrome.tabs.update(tabs[0].id, { url });
      }
    }
  });
}

// converts the "originalUrl" to the redirectUrl
// if defaultAccount is the same as in "?authuser={num}" or "/u/{num}" - returns null (meaning no need for redirect)
function convertToRedirectUrl(originalUrl, defaultAccount) {
  const url = new URL(originalUrl);
  const params = new URLSearchParams(url.search);
  // check if current user is not the same (?authuser={num} or /u/{num}/)
  if (`${params.get("authuser")}` === `${defaultAccount}`) return null;
  const uMatch = originalUrl.match(/\/u\/(\d+)\/?/i);
  if (uMatch && uMatch[1] && `${uMatch[1]}` === `${defaultAccount}`)
    return null;

  // current user is different, change
  params.delete("authuser");
  params.set("authuser", defaultAccount);
  url.search = params.toString();
  return url.toString();
}

function allAccounts(callback) {
  SyncStorage.get("accounts", callback);
}

function allSupportedGoogleServices() {
  return [
    {
      name: "Calendar",
      title: "Calendar",
      url: "calendar.google.com",
      img: "./images/logos/calendar.png",
    },
    {
      name: "Drive",
      title: "Drive",
      url: "drive.google.com",
      img: "./images/logos/drive.png",
    },
    {
      name: "Maps",
      title: "Maps",
      url: "maps.google.com",
      img: "./images/logos/maps.png",
    },
    {
      name: "Meet",
      title: "Meet",
      url: "meet.google.com",
      img: "./images/logos/meet.png",
    },
    {
      name: "Mail",
      title: "Mail",
      url: "mail.google.com",
      img: "./images/logos/mail.png",
    },
    {
      name: "Docs",
      title: "Docs",
      url: "docs.google.com",
      img: "./images/logos/docs.png",
    },
    {
      name: "Admin",
      title: "Admin",
      url: "admin.google.com",
      img: "./images/logos/admin.png",
    },
    {
      name: "Photos",
      title: "Photos",
      url: "photos.google.com",
      img: "./images/logos/photos.png",
    },
    {
      name: "Translate",
      title: "Translate",
      url: "translate.google.com",
      img: "./images/logos/translate.png",
    },
    {
      name: "Keep",
      title: "Keep",
      url: "keep.google.com",
      img: "./images/logos/keep.png",
    },
    {
      name: "Hangouts",
      title: "Hangouts",
      url: "hangouts.google.com",
      img: "./images/logos/hangouts.png",
    },
    {
      name: "Chat",
      title: "Chat",
      url: "chat.google.com",
      img: "./images/logos/chat.png",
    },
    {
      name: "Workspace",
      title: "Workspace",
      url: "workspace.google.com",
    },
    {
      name: "News",
      title: "News",
      url: "news.google.com",
      img: "./images/logos/news.png",
    },
    {
      name: "Ads",
      title: "Ads",
      url: "ads.google.com",
      img: "./images/logos/ads.png",
    },
    {
      name: "Ediscovery",
      title: "Ediscovery (Vault)",
      url: "ediscovery.google.com",
      img: "./images/logos/ediscovery.png",
    },
    {
      name: "Jamboard",
      title: "Jamboard",
      url: "jamboard.google.com",
      img: "./images/logos/jamboard.png",
    },
    {
      name: "Earth",
      title: "Earth",
      url: "earth.google.com",
      img: "./images/logos/earth.png",
    },
    {
      name: "Podcasts",
      title: "Podcasts",
      url: "podcasts.google.com",
      img: "./images/logos/podcasts.png",
    },
    {
      name: "Classroom",
      title: "Classroom",
      url: "classroom.google.com",
      img: "./images/logos/classroom.png",
    },
    {
      name: "Business",
      title: "Business",
      url: "business.google.com",
      img: "./images/logos/business.png",
    },
    {
      name: "MyAccount",
      title: "MyAccount",
      url: "myaccount.google.com",
    },
    {
      name: "Adsense",
      title: "Adsense",
      url: "adsense.google.com",
      img: "./images/logos/adsense.png",
    },
    {
      name: "Adwords",
      title: "Adwords",
      url: "adwords.google.com",
      img: "./images/logos/ads.png",
    },
    {
      name: "Cloud",
      title: "Cloud",
      url: "cloud.google.com",
      img: "./images/logos/cloud.png",
    },
    {
      name: "Analytics",
      title: "Analytics",
      url: "analytics.google.com",
      img: "./images/logos/analytics.png",
    },
    {
      name: "Firebase",
      title: "Firebase Console",
      url: "firebase.google.com",
      img: "./images/logos/firebase.png",
    },
    {
      name: "Google Play",
      title: "Google Play",
      url: "play.google.com",
      img: "./images/logos/play.png",
    },
  ];
}

class SyncStorage {
  static store(obj, callback) {
    chrome.storage.sync.set(obj, callback);
  }

  static get(key, callback) {
    chrome.storage.sync.get(key, callback);
  }
}
