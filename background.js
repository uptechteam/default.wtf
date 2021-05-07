let defaultAccount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ defaultAccount });
  console.log(`Default Account color set to ${defaultAccount}`);
});

chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
  const url = 'https://accounts.google.com/ListAccounts?gpsia=1&source=ogb&mo=1&origin=https://accounts.google.com'
  fetch(url)
      .then(response => (
          response.text()
      ))
      .then(function(rawText) {
        const parser = new DOMParser();
        const html = parser.parseFromString(rawText, 'application/xml').querySelector('script').innerHTML
        return html.split('\'')[1]
          .replace(/\\x([0-9a-fA-F]{2})/g, (match, paren) => (
              String.fromCharCode(parseInt(paren, 16))
          ))
          .replace(/\\\//g, '\/')
          .replace(/\\n/g, '')
      })
      .then(text => (
          JSON.parse(text)
      ))
      .then(sendResponse);
  return true
});