function setupUI() {
    getRules((data) => {
        const services = allSupportedGoogleServices();
        const accounts = allAccountsMock();
        setupAddNewRule(services, accounts);
        setupRules(data.rules)
    })
    
}

function setupAddNewRule(services, accounts) {
    var servicePickerDiv = document.getElementById('service_picker_div');
    servicePickerDiv.innerHTML = "";
    const servicePicker = document.createElement('select')
    servicePicker.id = 'service_picker'
    var serviceLabel = document.createElement('label')
    serviceLabel.appendChild(document.createTextNode('Select a Google service:'))
    serviceLabel.setAttribute('for', 'service_picker')
    servicePickerDiv.appendChild(serviceLabel)
    for (const service of services) {
        var opt = document.createElement('option');
        opt.appendChild(document.createTextNode(service.url));
        opt.value = service.url;
        servicePicker.appendChild(opt);
    }
    servicePickerDiv.appendChild(servicePicker);

    var accountPickerDiv = document.getElementById('account_picker_div');
    accountPickerDiv.innerHTML = "";
    const accountPicker = document.createElement('select')
    accountPicker.id = 'account_picker'
    var accountLabel = document.createElement('label')
    accountLabel.setAttribute('for', 'account_picker')
    accountLabel.appendChild(document.createTextNode('Select a default account:'))
    accountPickerDiv.appendChild(accountLabel)
    for (const account of accounts) {
        var opt = document.createElement('option');
        opt.appendChild(document.createTextNode(account.email));
        opt.value = account.id;
        accountPicker.appendChild(opt);
    }
    accountPickerDiv.appendChild(accountPicker);

    var actionButtonDiv = document.getElementById('action_button_div');
    actionButtonDiv.innerHTML = "";
    var button = document.createElement('button');
    button.appendChild(document.createTextNode('Add new rule'))
    button.onclick = function() {
        const serviceUrl = servicePicker.value;
        const accountIndex = accountPicker.selectedIndex;
        const accountId = accountPicker.options[accountIndex].value;
        const accountEmail = accountPicker.options[accountIndex].text;
        addRule(serviceUrl, accountEmail, accountId, function() {
            setupUI();
        });
    }
    actionButtonDiv.appendChild(button)
}

function setupRules(rules) {
    console.log(rules);
    const rulesBodyDiv = document.getElementById('rules_body');
    rulesBodyDiv.innerHTML = "";
    for (const rule of rules) {
        let a = document.createElement("a");
        a.classList.add("topA");

        let topDiv = document.createElement("div");
        topDiv.classList.add("top");

        let nameDiv = document.createElement("div");
        nameDiv.classList.add("name");
        nameDiv.appendChild(document.createTextNode(rule.serviceUrl)); // Name
        topDiv.appendChild(nameDiv);

        let emailDiv = document.createElement("div");
        emailDiv.classList.add("email");
        emailDiv.appendChild(document.createTextNode(rule.accountEmail)); // Email
        topDiv.appendChild(emailDiv);

        a.appendChild(topDiv);

        rulesBodyDiv.appendChild(a);
    }
}

function getRules(callback) {
    SyncStorage.get('rules', callback);
}

function addRule(serviceUrl, accountEmail, accountId, callback) {
    SyncStorage.get('rules', (data) => {
        console.log(data.rules);
        data.rules.push({ serviceUrl, accountId, accountEmail })
        SyncStorage.store({ rules: data.rules }, callback);
    });
}


setupUI();