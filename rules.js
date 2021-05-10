function setupUI() {
    getRules((data) => {
        const allServices = allSupportedGoogleServices()
        let services = [];
        if (data.rules.length > 0) {
            for (const service of allServices) {
                const alreadyInRules = data.rules.filter((e) => e.serviceUrl === service.url).length > 0;
                if (!alreadyInRules) {
                    services.push(service)
                }
            };
        } else {
            services = allServices;
        }
        const accounts = allAccountsMock();
        renderAddNewRule(services, accounts);
        renderRulesList(data.rules);
    })
    
}

function renderAddNewRule(services, accounts) {
    console.log(services);
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

function renderRulesList(rules) {
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

        let cornerDiv = document.createElement("div");
        cornerDiv.classList.add("corner");
        let button = document.createElement('button')
        button.appendChild(document.createTextNode('Delete'))
        button.onclick = function () {
            deleteRule(rule.serviceUrl, function() {
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
    SyncStorage.get('rules', callback);
}

function addRule(serviceUrl, accountEmail, accountId, callback) {
    SyncStorage.get('rules', (data) => {
        data.rules.push({ serviceUrl, accountId, accountEmail })
        SyncStorage.store({ rules: data.rules }, callback);
    });
}


setupUI();