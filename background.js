let defaultAccount = "1";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ defaultAccount });
  console.log(`Default Account color set to ${defaultAccount}`);
});

