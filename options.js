let page = document.getElementById("buttonDiv");
let selectedClassName = "current";
const presetAccountNumbers = ["0", "1", "2", "3"];

// Reacts to a button click by marking marking the selected button and saving
// the selection
function handleButtonClick(event) {
  console.log("handleButtonClick for Options page, target: ", event.target);

  // Remove styling from the previously selected default account
  let current = event.target.parentElement.querySelector(
    `.${selectedClassName}`
  );
  if (current && current !== event.target) {
    current.classList.remove(selectedClassName);
  }

  // Mark the button as selected
  let defaultAccount = event.target.dataset.defaultAccount;
  event.target.classList.add(selectedClassName);
  chrome.storage.sync.set({ defaultAccount });
}

// Add a button to the page for each supplied defaultAccount
function constructOptions(accountNumbers) {
  chrome.storage.sync.get("defaultAccount", (data) => {
    let currentAccount = data.defaultAccount;

    // For each num we were provided…
    for (let accountNum of accountNumbers) {
      // …crate a button with that color…
      let button = document.createElement("button");
      button.dataset.defaultAccount = accountNum;
      button.textContent = accountNum;
      // button.style.backgroundColor = accountNum;

      // …mark the currently selected account…
      if (accountNum === currentAccount) {
        button.classList.add(selectedClassName);
      }

      // …and register a listener for when that button is clicked
      button.addEventListener("click", handleButtonClick);
      page.appendChild(button);
    }
  });
}

// Initialize the page by constructing the color options
constructOptions(presetAccountNumbers);
