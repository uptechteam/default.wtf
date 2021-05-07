// Initialize butotn with users's prefered color
const changeColor = document.getElementById("changeColor");

chrome.storage.sync.get("defaultAccount", ({ defaultAccount }) => {
  changeColor.textContent = defaultAccount;
  console.log("defaultAccount set : ", defaultAccount);
});

// When the button is clicked, inject setPageBackgroundColor into current page
changeColor.addEventListener("click", async () => {
  console.log("changeColor button clicked, target: ");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  var tabUrl = tab.url; //encodeURIComponent(tab.url);
  var tabTitle = tab.title; //encodeURIComponent(tab.title);

  console.log("tabUrl: ", tabUrl);
  console.log("tabTitle: ", tabTitle);

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: setPageBackgroundColor,
  });
});

// The body of this function will be execuetd as a content script inside the
// current page
function setPageBackgroundColor() {
  // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // var tabUrl = encodeURIComponent(tab.url);
  // var tabTitle = encodeURIComponent(tab.title);
  // console.log("tabUrl: ", tabUrl);
  // console.log("tabTitle: ", tabTitle);
  // var myNewUrl =
  //   "https://www.mipanga.com/Content/Submit?url=" +
  //   tabUrl +
  //   "&title=" +
  //   tabTitle;
  // //Update the url here.
  // chrome.tabs.update(tab.id, { url: myNewUrl });

  chrome.storage.sync.get("defaultAccount", ({ defaultAccount }) => {
    document.body.style.backgroundColor = "red";
  });
}
