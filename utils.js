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

function getAccountForService(url, rules) {
  for (const rule of rules) {
    const reg = new RegExp(
      `^https?:\/\/[^?&]*${rule.serviceName.toLowerCase()}\.google\.co.*`,
      "is"
    );
    if (reg.test(url)) {
      return rule.accountId;
    }
  }
}

function allAccounts(callback) {
  SyncStorage.get("accounts", callback);
}

function allSupportedGoogleServices() {
  return [
    {
      name: "Calendar",
      url: "calendar.google.com",
      img: "./images/logos/calendar.png",
    },
    {
      name: "Drive",
      url: "drive.google.com",
      img: "./images/logos/drive.png",
    },
    {
      name: "Maps",
      url: "maps.google.com",
      img: "./images/logos/maps.png",
    },
    {
      name: "Meet",
      url: "meet.google.com",
      img: "./images/logos/meet.png",
    },
    {
      name: "Mail",
      url: "mail.google.com",
      img: "./images/logos/mail.png",
    },
    {
      name: "Docs",
      url: "docs.google.com",
      img: "./images/logos/docs.png",
    },
    {
      name: "Admin",
      url: "admin.google.com",
    },
    {
      name: "Photos",
      url: "photos.google.com",
      img: "./images/logos/photos.png",
    },
    {
      name: "Translate",
      url: "translate.google.com",
    },
    {
      name: "Keep",
      url: "keep.google.com",
    },
    {
      name: "Hangouts",
      url: "hangouts.google.com",
    },
    {
      name: "Chat",
      url: "chat.google.com",
    },
    {
      name: "Currents",
      url: "currents.google.com",
    },
    {
      name: "News",
      url: "news.google.com",
    },
    {
      name: "Ads",
      url: "ads.google.com",
    },
    {
      name: "Ediscovery",
      url: "ediscovery.google.com",
    },
    {
      name: "Jamboard",
      url: "jamboard.google.com",
    },
    {
      name: "Earth",
      url: "earth.google.com",
      img: "./images/logos/earth.png",
    },
    {
      name: "Travel",
      url: "travel.google.com",
    },
    {
      name: "Podcasts",
      url: "podcasts.google.com",
      img: "./images/logos/podcasts.png",
    },
    {
      name: "Classroom",
      url: "classroom.google.com",
    },
    {
      name: "Business",
      url: "business.google.com",
      img: "./images/logos/business.png",
    },
    {
      name: "MyAccount",
      url: "myaccount.google.com",
    },
    {
      name: "Adsense",
      url: "adsense.google.com",
    },
    {
      name: "Adwords",
      url: "adwords.google.com",
    },
    {
      name: "Cloud",
      url: "cloud.google.com",
      img: "./images/logos/cloud.png",
    },
    {
      name: "Analytics",
      url: "analytics.google.com",
      img: "./images/logos/analytics.png",
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
