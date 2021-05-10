let defAccount = 0;

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
  chrome.storage.sync.set({ accounts });
  renderAccounts(accounts, defAccount); // re-render accounts that arrived
}

function renderAccounts(accounts, defaultAccount) {
  const accountsBody = document.getElementById("accounts_body");
  accountsBody.innerHTML = ""; // to remove all children, if any
  accounts.forEach((user) => {
    // There is useless info in response[0]; response[1] has the accounts
    let a = document.createElement("a");
    a.classList.add("topA");

    let img = document.createElement("img");
    img.classList.add("img");
    img.src = user.profileUrl;
    a.appendChild(img);

    let topDiv = document.createElement("div");
    topDiv.classList.add("top");

    let nameDiv = document.createElement("div");
    nameDiv.classList.add("name");
    nameDiv.appendChild(document.createTextNode(user.name));
    topDiv.appendChild(nameDiv);

    let emailDiv = document.createElement("div");
    emailDiv.classList.add("email");
    emailDiv.appendChild(document.createTextNode(user.email)); // Email
    topDiv.appendChild(emailDiv);

    a.appendChild(topDiv);

    if (!user.isLoggedIn) {
      let cornerDiv = document.createElement("div");
      cornerDiv.classList.add("corner");
      cornerDiv.appendChild(document.createTextNode("Signed out"));
      a.appendChild(cornerDiv);
      a.addEventListener("click", () => {
        chrome.tabs.query(
          {
            // Get current tab
            active: true,
            currentWindow: true,
          },
          signIn(info[3])
        ); // Navigate to signin
      });
    } else {
      if (user.index === defaultAccount) {
        // Account index (pretty sure)
        let cornerDiv = document.createElement("div");
        cornerDiv.classList.add("corner");
        cornerDiv.appendChild(document.createTextNode("Selected"));
        a.appendChild(cornerDiv);
      }
      a.addEventListener("click", async () => {
        chrome.storage.sync.set({ defaultAccount: user.index }, function () {
          redirectCurrectTab(user.index);
          window.close();
        });
      });
    }
    accountsBody.appendChild(a);
  });
}

chrome.storage.sync.get(["accounts", "defaultAccount"], (data) => {
  defAccount = data.defaultAccount ?? 0;
  if (data.accounts && data.accounts.length) {
    // render accounts that are in the store, if any
    renderAccounts(data.accounts, defAccount);
  }
  chrome.runtime.sendMessage("fetch_google_accounts", populate);
});

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