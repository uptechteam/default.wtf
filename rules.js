function setupUI() {
  getRules((data) => {
    const allServices = allSupportedGoogleServices();
    const rulesUrls = data.rules.map((r) => r.serviceUrl);
    let services = allServices.filter((s) => rulesUrls.indexOf(s.url) === -1);
    allAccounts((data) => {
      renderAddNewRule(services, data.accounts);
    });
    renderRulesList(data.rules);
  });
}

function renderAddNewRule(services, accounts) {
  const servicePickerDiv = document.getElementById("service_picker_div");
  servicePickerDiv.innerHTML = "";
  const servicePicker = document.createElement("select");
  servicePicker.id = "service_picker";
  const serviceLabel = document.createElement("label");
  serviceLabel.appendChild(document.createTextNode("Select a Google service:"));
  serviceLabel.setAttribute("for", "service_picker");
  servicePickerDiv.appendChild(serviceLabel);
  for (const service of services) {
    const opt = document.createElement("option");
    opt.appendChild(document.createTextNode(service.name));
    opt.value = JSON.stringify(service);
    servicePicker.appendChild(opt);
  }
  servicePickerDiv.appendChild(servicePicker);

  const accountPickerDiv = document.getElementById("account_picker_div");
  accountPickerDiv.innerHTML = "";
  const accountPicker = document.createElement("select");
  accountPicker.id = "account_picker";
  const accountLabel = document.createElement("label");
  accountLabel.setAttribute("for", "account_picker");
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

  const actionButtonDiv = document.getElementById("action_button_div");
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
  const rulesBodyDiv = document.getElementById("rules_body");
  rulesBodyDiv.innerHTML = "";
  for (const rule of rules) {
    let a = document.createElement("a");
    a.classList.add("topA");

    let topDiv = document.createElement("div");
    topDiv.classList.add("top");

    let img = document.createElement("img");
    img.classList.add("img");
    img.src = rule.serviceImg ?? "./images/logos/google.png";
    a.appendChild(img);

    let nameDiv = document.createElement("div");
    nameDiv.classList.add("name");
    nameDiv.appendChild(document.createTextNode(rule.serviceUrl)); // Name
    topDiv.appendChild(nameDiv);

    let emailDiv = document.createElement("div");
    emailDiv.classList.add("email");
    emailDiv.appendChild(document.createTextNode(rule.accountEmail)); // Email
    topDiv.appendChild(emailDiv);
    a.appendChild(topDiv);

    let cornerDiv = document.createElement("div");
    cornerDiv.classList.add("corner");
    let button = document.createElement("button");
    button.appendChild(document.createTextNode("Delete"));
    button.onclick = function () {
      deleteRule(rule.serviceUrl, function () {
        setupUI();
      });
    };
    cornerDiv.appendChild(button);
    a.appendChild(cornerDiv);

    rulesBodyDiv.appendChild(a);
  }
}

function deleteRule(serviceUrl, callback) {
  getRules((data) => {
    const rules = data.rules.filter((r) => r.serviceUrl !== serviceUrl);
    SyncStorage.store({ rules }, callback);
  });
}

function getRules(callback) {
  SyncStorage.get("rules", callback);
}

function addRule(rule, callback) {
  SyncStorage.get("rules", (data) => {
    data.rules.push(rule);
    SyncStorage.store({ rules: data.rules }, callback);
  });
}

setupUI();
