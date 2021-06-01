function setupUI() {
  getRules((data) => {
    const rules = data.rules ?? [];
    const allServices = allSupportedGoogleServices();
    const rulesUrls = rules.map((r) => r.serviceUrl);
    let services = allServices.filter((s) => rulesUrls.indexOf(s.url) === -1);
    services.sort((a, b) =>
      a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
    );
    allAccounts((data) => {
      const accounts = data.accounts ?? [];
      renderAddNewRule(services, accounts);
    });
    renderRulesList(rules);
  });
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("accounts" in changes) {
    setupUI();
  }
});

function renderAddNewRule(services, accounts) {
  const servicePickerDiv = document.getElementById("service-picker-container");
  servicePickerDiv.innerHTML = "";
  const serviceArrowPicker = document.createElement("img");
  serviceArrowPicker.src = "images/arrow.svg";
  const servicePicker = document.createElement("select");
  servicePicker.id = "service-picker";
  const serviceLabel = document.createElement("label");
  serviceLabel.appendChild(document.createTextNode("Select a Google service:"));
  serviceLabel.setAttribute("for", "service-picker");
  servicePickerDiv.appendChild(serviceLabel);
  for (const service of services) {
    const opt = document.createElement("option");
    opt.appendChild(document.createTextNode(service.name));
    opt.value = JSON.stringify(service);
    servicePicker.appendChild(opt);
  }
  servicePickerDiv.appendChild(servicePicker);
  servicePickerDiv.appendChild(serviceArrowPicker);

  const accountPickerDiv = document.getElementById("account-picker-container");
  accountPickerDiv.innerHTML = "";
  const accountArrowPicker = document.createElement("img");
  accountArrowPicker.src = "images/arrow.svg";
  const accountPicker = document.createElement("select");
  accountPicker.id = "account-picker";
  const accountLabel = document.createElement("label");
  accountLabel.setAttribute("for", "account-picker");
  accountLabel.appendChild(
    document.createTextNode("Select a default account:")
  );
  accountPickerDiv.appendChild(accountLabel);
  for (const account of accounts) {
    const opt = document.createElement("option");
    opt.appendChild(
      document.createTextNode(`${account.index + 1}) ${account.email}`)
    );
    opt.value = JSON.stringify(account);
    accountPicker.appendChild(opt);
  }
  accountPickerDiv.appendChild(accountPicker);
  accountPickerDiv.appendChild(accountArrowPicker);

  const actionButtonDiv = document.getElementById("action-button-div");
  actionButtonDiv.innerHTML = "";
  const button = document.createElement("button");
  button.appendChild(document.createTextNode("Add new rule"));
  button.onclick = function () {
    const serviceValue = JSON.parse(
      servicePicker.options[servicePicker.selectedIndex].value
    );
    const serviceName = serviceValue.name;
    const serviceUrl = serviceValue.url;
    const serviceImg = serviceValue.img;

    const accountValue = JSON.parse(
      accountPicker.options[accountPicker.selectedIndex].value
    );
    const accountId = accountValue.index;
    const accountEmail = accountValue.email;

    addRule(
      { serviceName, serviceUrl, serviceImg, accountEmail, accountId },
      function () {
        setupUI();
      }
    );
  };
  actionButtonDiv.appendChild(button);
}

function renderRulesList(rules) {
  const rulesBodyDiv = document.getElementById("rules-body");
  rulesBodyDiv.innerHTML = "";
  for (const rule of rules) {
    const t = document.getElementById("cell_template").content;
    const cellContent = document.importNode(t, true);
    cellContent.querySelector(".cell-image").src =
      rule.serviceImg ?? "./images/logos/google.png";
    cellContent.querySelector(".cell-title").textContent = rule.serviceUrl;
    cellContent.querySelector(".cell-description").textContent =
      rule.accountEmail;

    const cornerDiv = cellContent.querySelector(".cell-corner");
    const button = document.createElement("button");
    button.className = "cell-delete";
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="white"/>
        <path d="M8.36477 9.11767H15.6354V15.6308C15.6354 16.8288 14.6642 17.8 13.4661 17.8H10.534C9.33597 17.8 8.36477 16.8288 8.36477 15.6308V9.11767Z" stroke="#8B8792" stroke-width="1.2"/>
        <rect x="10.5883" y="11.3415" width="0.705882" height="3.52941" rx="0.352941" fill="#8B8792"/>
        <rect x="12.7058" y="11.3415" width="0.705882" height="3.52941" rx="0.352941" fill="#8B8792"/>
        <path d="M6.35291 8.97921C6.35291 8.72431 6.55954 8.51767 6.81444 8.51767H17.1855C17.4404 8.51767 17.647 8.72431 17.647 8.97921C17.647 9.23411 17.4404 9.44075 17.1855 9.44075H6.81444C6.55954 9.44075 6.35291 9.23411 6.35291 8.97921Z" fill="#8B8792"/>
        <path d="M9.28226 8.51773V9.11773H9.88226H14.1176H14.7176V8.51773C14.7176 7.01682 13.5008 5.80009 11.9999 5.80009C10.499 5.80009 9.28226 7.01682 9.28226 8.51773Z" stroke="#8B8792" stroke-width="1.2"/>
      </svg>
    `;

    button.onclick = function () {
      deleteRule(rule.serviceUrl, function () {
        setupUI();
      });
    };
    cornerDiv.appendChild(button);
    rulesBodyDiv.appendChild(cellContent);
  }
}

function deleteRule(serviceUrl, callback) {
  getRules((data) => {
    const rules = (data.rules ?? []).filter((r) => r.serviceUrl !== serviceUrl);
    SyncStorage.store({ rules }, callback);
  });
}

function getRules(callback) {
  SyncStorage.get("rules", callback);
}

function addRule(rule, callback) {
  SyncStorage.get("rules", (data) => {
    const rules = data.rules ?? [];
    rules.push(rule);
    SyncStorage.store({ rules }, callback);
  });
}

setupUI();
