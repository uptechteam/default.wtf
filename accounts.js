let defAccount = 0;

window.onload = function () {
  const accounts = document.getElementById("accounts_button");
  accounts.onclick = function (event) {
    openPage(event, "Accounts");
  };
  document.getElementById("rules_button").onclick = function (event) {
    openPage(event, "Rules");
  };
  accounts.click();
};

function signIn(email) {
  // A builder that returns a function to set the url to allow the user to log in to a signed out account
  return (responses) => {
    let response = responses[0],
      url;
    if (response.url.includes("google")) {
      // Weak test for if Google will redirect to that url
      url = new URL(response.url);
    } else {
      url = new URL("https://www.google.com/webhp");
    }
    let params = new URLSearchParams(url.search);

    // This empties the authuser and moves it to the end to model the format that Google uses for this
    params.delete("authuser");
    params.set("authuser", "");

    url.search = params.toString();
    let newURL =
      "https://accounts.google.com/AccountChooser?source=ogb&continue=" +
      encodeURIComponent(url.toString()) +
      "&Email=" +
      email;

    window.open(newURL);
    window.close(); // Just in case
  };
}

function populate(response) {
  // Create the GUI from the strange nested Array structure that Google accounts responds with
  const accounts = response[1].map((info) => ({
    index: info[7],
    name: info[2],
    email: info[3],
    profileUrl: info[4],
    isLoggedIn: info.length >= 16, // If the account is signed in (as far as I know)
  }));
  SyncStorage.store({ accounts });
  renderNumberOfAccounts(accounts);
  renderAccounts(accounts, defAccount); // re-render accounts that arrived
}

function renderNumberOfAccounts(accounts) {
  const accountButton = document.getElementById("accounts_button");
  const numberOfAccounts = document.createElement("span");
  numberOfAccounts.innerHTML = ` (${accounts.length})`;
  accountButton.appendChild(numberOfAccounts);
}

function renderAccounts(accounts, defaultAccount) {
  const accountsBody = document.getElementById("accounts_body");
  accountsBody.innerHTML = ""; // to remove all children, if any

  accounts.forEach((user) => {
    const t = document.getElementById("cell_template").content;
    const cellContent = document.importNode(t, true);
    cellContent.querySelector(".cell-image").src = user.profileUrl;
    let title;
    if (user.isLoggedIn) {
      title = `${user.index + 1}) ${user.name}`;
    } else {
      title = user.name;
    }
    cellContent.querySelector(".cell-title").textContent = title;
    cellContent.querySelector(".cell-description").textContent = user.email;

    if (!user.isLoggedIn) {
      cellContent.querySelector(".cell-corner").textContent = "Signed out";
      cellContent.querySelector(".cell-body").addEventListener("click", () => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          signIn(info[3])
        );
      });
    } else {
      if (user.index === defaultAccount) {
        const checkedImage = document.createElement("img");
        checkedImage.src = "images/checked.svg";
        cellContent.querySelector(".cell-corner").appendChild(checkedImage);
      }
      cellContent
        .querySelector(".cell-body")
        .addEventListener("click", async () => {
          console.log("click");
          SyncStorage.store({ defaultAccount: user.index }, function () {
            redirectCurrectTab(user.index);
            window.close();
          });
        });
    }
    accountsBody.appendChild(cellContent);
  });
}

SyncStorage.get(["accounts", "defaultAccount"], (data) => {
  defAccount = data.defaultAccount ?? 0;
  if (data.accounts && data.accounts.length) {
    // render accounts that are in the store, if any
    renderAccounts(data.accounts, defAccount);
  }
  chrome.runtime.sendMessage("fetch_google_accounts", populate);
});

function openPage(evt, name) {
  // Declare all variables
  let i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(name).style.display = "block";
  evt.currentTarget.className += " active";
}
