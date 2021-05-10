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

function allAccountsMock() {
  return [
    {
      id: 0,
      email: "roman.furman6@gmail.com"
    },
    {
      id: 1,
      email: "roman.furman@uptech.team"
    }
  ]
}

function allSupportedGoogleServices() {
  return [
    {
        name: "Calendar",
        url: "https://calendar.google.com/"
    },
    {
        name: "Drive",
        url: "https://drive.google.com/"
    },
    {
        name: "Maps",
        url: "https://maps.google.com/"
    },
    {
        name: "Meet",
        url: "https://meet.google.com/"
    },
    {
      name: "Mail",
      url: "https://mail.google.com/"
    },
    {
        name: "Docs",
        url: "https://docs.google.com/"
    },
    {
      name: "Admin",
      url: "https://admin.google.com/"
    },
    {
      name: "Photos",
      url: "https://photos.google.com/"
    },
    {
      name: "Translate",
      url: "https://translate.google.com/"
    },
    {
      name: "Keep",
      url: "https://keep.google.com/"
    },
    {
      name: "Hangouts",
      url: "https://hangouts.google.com/"
    },
    {
      name: "Chat",
      url: "https://chat.google.com/"
    },
    {
      name: "Currents",
      url: "https://currents.google.com/"
    },
    {
      name: "News",
      url: "https://news.google.com/"
    },
    {
      name: "Ads",
      url: "https://ads.google.com/"
    },
    {
      name: "Ediscovery",
      url: "https://ediscovery.google.com/"
    },
    {
      name: "Jamboard",
      url: "https://jamboard.google.com/"
    },
    {
      name: "Earth",
      url: "https://earth.google.com/"
    },
    {
      name: "Travel",
      url: "https://travel.google.com/"
    },
    {
      name: "Podcasts",
      url: "https://podcasts.google.com/"
    },
    {
      name: "Classroom",
      url: "https://classroom.google.com/"
    },
    {
      name: "Business",
      url: "https://business.google.com/"
    },
    {
      name: "MyAccount",
      url: "https://myaccount.google.com/"
    },
    {
      name: "Adsense",
      url: "https://adsense.google.com/"
    },
    {
      name: "Adwords",
      url: "https://adsense.google.com/"
    },
    {
      name: "Cloud",
      url: "https://cloud.google.com/"
    },
    {
      name: "Analytics",
      url: "https://analytics.google.com/"
    }
  ]
}

class SyncStorage {

  static store(obj, callback) {
    chrome.storage.sync.set(obj, callback);  
  }
  
  static get(key, callback) {
    chrome.storage.sync.get(key, callback)
  }

}

