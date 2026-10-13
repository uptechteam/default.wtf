const MAX_SHORTCUTS = 9;

const state = {
  enabled: true,
  defaultAccount: 0,
  defaultAccountEmail: undefined,
  rules: [],
  accounts: [],
  accountsStatus: "loading", // "loading" | "loaded" | "error"
};

const $ = (id) => document.getElementById(id);

function fromTemplate(id) {
  return $(id).content.firstElementChild.cloneNode(true);
}

const signedInAccounts = () => state.accounts.filter((a) => a.isLoggedIn);

// the account that is currently the default one (by email, accounts' indexes can change)
function defaultAccountIndex() {
  return resolveAccountIndex(state.accounts, state.defaultAccountEmail, state.defaultAccount);
}

function setAvatar(avatar, imageUrl, label) {
  const img = avatar.querySelector("img");
  avatar.prepend(document.createTextNode((label || "?").trim().charAt(0).toUpperCase()));
  if (imageUrl) {
    img.src = imageUrl;
    img.onerror = () => img.remove(); // fall back to the initial
  } else {
    img.remove();
  }
}

/* ---------- Tabs ---------- */

function selectTab(name) {
  for (const tab of ["accounts", "rules"]) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute("aria-selected", `${selected}`);
    $(`tab-${tab}`).tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  }
  try {
    localStorage.setItem("selectedTab", name);
  } catch {}
}

function setupTabs() {
  const tabs = ["accounts", "rules"];
  tabs.forEach((name, i) => {
    const tab = $(`tab-${name}`);
    tab.addEventListener("click", () => selectTab(name));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      $(`tab-${next}`).focus();
    });
  });
  let selected = "accounts";
  try {
    selected = localStorage.getItem("selectedTab") || selected;
  } catch {}
  selectTab(tabs.includes(selected) ? selected : "accounts");
}

/* ---------- Accounts ---------- */

function renderAccounts() {
  const list = $("accounts-list");
  const message = $("accounts-state");
  list.textContent = "";
  message.hidden = true;

  $("accounts-count").textContent = signedInAccounts().length || "";

  if (!state.accounts.length) {
    if (state.accountsStatus === "loading") {
      for (let i = 0; i < 2; i++) {
        const row = fromTemplate("account-template");
        row.classList.add("skeleton");
        row.querySelector(".avatar img").remove();
        row.querySelector(".row-title").textContent = "Loading";
        row.querySelector(".row-subtitle").textContent = "Loading";
        row.tabIndex = -1;
        list.append(row);
      }
    } else {
      message.hidden = false;
      message.textContent =
        state.accountsStatus === "error"
          ? "Couldn't load your Google accounts. Check your connection and reopen this popup."
          : "You're not signed in to Google. Sign in to pick a default account.";
    }
    return;
  }

  const defaultIndex = defaultAccountIndex() ?? 0;
  let shortcut = 0;
  for (const account of state.accounts) {
    const row = fromTemplate("account-template");
    setAvatar(row.querySelector(".avatar"), account.profileUrl, account.name || account.email);
    row.querySelector(".row-title").textContent = account.name || account.email;
    row.querySelector(".row-subtitle").textContent = account.email;
    const end = row.querySelector(".row-end");

    if (account.isLoggedIn) {
      shortcut++;
      const isDefault = account.index === defaultIndex;
      row.setAttribute("aria-checked", `${isDefault}`);
      if (shortcut <= MAX_SHORTCUTS) {
        const kbd = document.createElement("kbd");
        kbd.textContent = `Alt+${shortcut}`;
        kbd.title = `Switch the current tab with Alt+${shortcut}`;
        end.append(kbd);
      }
      const radio = document.createElement("span");
      radio.className = "radio";
      end.append(radio);
      row.addEventListener("click", () => setDefaultAccount(account));
    } else {
      row.classList.add("signed-out");
      row.removeAttribute("role");
      row.title = `Sign in to ${account.email}`;
      const badge = document.createElement("span");
      badge.className = "badge action";
      badge.textContent = "Sign in";
      end.append(badge);
      row.addEventListener("click", () => signIn(account.email));
    }
    list.append(row);
  }
}

function setDefaultAccount(account) {
  SyncStorage.store(
    { defaultAccount: account.index, defaultAccountEmail: account.email },
    () => {
      if (state.enabled) redirectCurrentTab(account.index);
      window.close();
    }
  );
}

// opens Google's account chooser to sign in to a signed out account,
// continuing to the current Google page
function signIn(email) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const current = tabs && tabs[0];
    let url;
    try {
      url = new URL(current && isAnyGoogleUrl(current.url) ? current.url : "https://www.google.com/webhp");
    } catch {
      url = new URL("https://www.google.com/webhp");
    }
    // This empties the authuser and moves it to the end to model the format that Google uses for this
    url.searchParams.delete("authuser");
    url.searchParams.set("authuser", "");
    const chooserUrl =
      "https://accounts.google.com/AccountChooser?source=ogb&continue=" +
      encodeURIComponent(url.toString()) +
      "&Email=" +
      encodeURIComponent(email);
    chrome.tabs.create({ url: chooserUrl });
    window.close();
  });
}

/* ---------- Picker ---------- */

// The most used services, shown first in the service picker
const POPULAR_SERVICES = ["Mail", "Calendar", "Drive", "Docs", "Meet", "Chat", "Maps", "Photos"];

let pickerId = 0;
let openPicker = null;

// A select with images and an optional search, rendered inline so it is never clipped by the popup.
// items: [{ value, label, sublabel?, img?, group?, disabled?, warning? }]
function createPicker({ label, searchPlaceholder, compact = false, onChange }) {
  const id = `picker-${++pickerId}`;
  const root = document.createElement("div");
  root.className = `picker${compact ? " compact" : ""}`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "picker-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", label);
  const chevron = '<svg class="chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const panel = document.createElement("div");
  panel.className = "picker-panel";
  panel.hidden = true;

  let search = null;
  if (searchPlaceholder) {
    search = document.createElement("input");
    search.type = "search";
    search.className = "picker-search";
    search.placeholder = searchPlaceholder;
    search.setAttribute("aria-label", searchPlaceholder);
    search.setAttribute("aria-controls", `${id}-list`);
    search.autocomplete = "off";
    panel.append(search);
  }

  const list = document.createElement("ul");
  list.className = "picker-list";
  list.id = `${id}-list`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);
  list.tabIndex = -1;
  panel.append(list);
  root.append(button, panel);

  let items = [];
  let value = null;
  let active = -1; // index in the visible options

  const selectedItem = () => items.find((i) => i.value === value) || null;
  const visibleOptions = () => [...list.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];

  function itemContent(item, withSublabel) {
    const fragment = document.createDocumentFragment();
    const avatar = document.createElement("span");
    avatar.className = `avatar small${item.round ? "" : " service"}`;
    avatar.append(document.createElement("img"));
    setAvatar(avatar, item.img, item.label);
    const text = document.createElement("span");
    text.className = "picker-text";
    const title = document.createElement("span");
    title.className = "picker-label";
    title.textContent = item.label;
    text.append(title);
    if (withSublabel && item.sublabel) {
      const sub = document.createElement("span");
      sub.className = "picker-sublabel";
      sub.textContent = item.sublabel;
      text.append(sub);
    }
    fragment.append(avatar, text);
    return fragment;
  }

  function renderButton() {
    const item = selectedItem();
    button.textContent = "";
    button.classList.toggle("warning", Boolean(item && item.warning));
    button.title = item && item.warning ? item.warning : "";
    if (item) {
      button.append(itemContent(item, !compact));
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "picker-text picker-placeholder";
      placeholder.textContent = items.length ? `Choose ${label.toLowerCase()}` : "Nothing to choose";
      button.append(placeholder);
    }
    button.insertAdjacentHTML("beforeend", chevron);
    button.disabled = !items.some((i) => !i.disabled);
  }

  function setActive(index) {
    const options = visibleOptions();
    options.forEach((o) => o.classList.remove("active"));
    active = options.length ? Math.max(0, Math.min(index, options.length - 1)) : -1;
    const option = options[active];
    if (option) {
      option.classList.add("active");
      option.scrollIntoView({ block: "nearest" });
      (search || list).setAttribute("aria-activedescendant", option.id);
    }
  }

  function renderList() {
    const query = search ? search.value.trim().toLowerCase() : "";
    list.textContent = "";
    const matches = items.filter(
      (i) => !query || `${i.label} ${i.sublabel || ""} ${i.keywords || ""}`.toLowerCase().includes(query)
    );
    let group = null;
    matches.forEach((item, n) => {
      if (!query && item.group && item.group !== group) {
        group = item.group;
        const header = document.createElement("li");
        header.className = "picker-group";
        header.setAttribute("role", "presentation");
        header.textContent = group;
        list.append(header);
      }
      const option = document.createElement("li");
      option.id = `${id}-option-${n}`;
      option.className = "picker-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", `${item.value === value}`);
      if (item.disabled) option.setAttribute("aria-disabled", "true");
      option.append(itemContent(item, true));
      option.addEventListener("mousedown", (e) => e.preventDefault()); // keep the focus in the search
      option.addEventListener("click", () => !item.disabled && choose(item.value));
      option.addEventListener("mousemove", () => {
        const index = visibleOptions().indexOf(option);
        if (index !== active) setActive(index);
      });
      list.append(option);
    });
    if (!matches.length) {
      const empty = document.createElement("li");
      empty.className = "picker-empty";
      empty.textContent = "No matches";
      list.append(empty);
    }
    const selectedIndex = visibleOptions().findIndex((o) => o.getAttribute("aria-selected") === "true");
    setActive(query || selectedIndex < 0 ? 0 : selectedIndex);
  }

  function open() {
    if (openPicker && openPicker !== api) openPicker.close();
    openPicker = api;
    panel.hidden = false;
    root.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    if (search) search.value = "";
    renderList();
    (search || list).focus();
  }

  function close(focusButton = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    root.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    if (openPicker === api) openPicker = null;
    if (focusButton) button.focus();
  }

  function choose(newValue) {
    const changed = newValue !== value;
    value = newValue;
    renderButton();
    close(true);
    if (changed && onChange) onChange(value);
  }

  function onKeyDown(event) {
    const options = visibleOptions();
    if (event.key === "ArrowDown") setActive(active + 1);
    else if (event.key === "ArrowUp") setActive(active - 1);
    else if (event.key === "Home" && !search) setActive(0);
    else if (event.key === "End" && !search) setActive(options.length - 1);
    else if (event.key === "Enter") {
      const option = options[active];
      if (option) option.click();
    } else if (event.key === "Escape") close(true);
    else if (event.key === "Tab") close();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  button.addEventListener("click", () => (panel.hidden ? open() : close(true)));
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  });
  (search || list).addEventListener("keydown", onKeyDown);
  if (search) search.addEventListener("input", renderList);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) close();
  });

  const api = {
    element: root,
    close,
    get value() {
      return value;
    },
    setItems(newItems, newValue = value) {
      items = newItems;
      const enabled = items.filter((i) => !i.disabled);
      value = items.some((i) => i.value === newValue) ? newValue : enabled.length ? enabled[0].value : null;
      renderButton();
      if (!panel.hidden) renderList();
    },
  };
  return api;
}

document.addEventListener("mousedown", (event) => {
  if (openPicker && !openPicker.element.contains(event.target)) openPicker.close();
});

/* ---------- Rules ---------- */

const ruleService = (rule) =>
  getServiceByUrl(rule.serviceUrl) || {
    title: rule.serviceTitle || rule.serviceUrl,
    url: rule.serviceUrl,
    img: rule.serviceImg || "./images/logos/google.png",
  };

const accountItem = (account) => ({
  value: account.email,
  label: account.email,
  sublabel: account.name,
  img: account.profileUrl,
  round: true,
});

// signed in accounts, plus the rule's account if it is signed out
function accountItems(selectedEmail) {
  const items = signedInAccounts().map(accountItem);
  if (selectedEmail && !items.some((i) => i.value === selectedEmail)) {
    const account = state.accounts.find((a) => a.email === selectedEmail);
    items.unshift({
      ...(account ? accountItem(account) : { value: selectedEmail, label: selectedEmail, round: true }),
      sublabel: "Signed out",
      disabled: true,
      warning: "This account is signed out, the rule is not applied",
    });
  }
  return items;
}

// legacy rules are stored by account index only
function ruleAccountEmail(rule) {
  if (rule.accountEmail) return rule.accountEmail;
  const account = state.accounts.find((a) => a.index === rule.accountId);
  return account ? account.email : undefined;
}

function buildRule(service, email) {
  const account = state.accounts.find((a) => a.email === email);
  return {
    serviceName: service.name,
    serviceTitle: service.title,
    serviceUrl: service.url,
    serviceImg: service.img,
    accountEmail: email,
    accountId: account ? account.index : undefined,
  };
}

function saveRules(rules) {
  SyncStorage.store({ rules });
}

let servicePicker;
let accountPicker;

function renderRuleForm() {
  const ruled = new Set(state.rules.map((r) => r.serviceUrl));
  const available = GOOGLE_SERVICES.filter((s) => !s.hidden && !ruled.has(s.url));
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const popular = POPULAR_SERVICES.map((name) => available.find((s) => s.name === name)).filter(Boolean);
  const others = available.filter((s) => !popular.includes(s)).sort(byTitle);
  const serviceItem = (group) => (s) => ({
    value: s.url,
    label: s.title,
    sublabel: s.url,
    img: s.img,
    keywords: s.name,
    group,
  });
  servicePicker.setItems([
    ...popular.map(serviceItem("Popular")),
    ...others.map(serviceItem("All services")),
  ]);
  accountPicker.setItems(accountItems());

  $("add-rule").disabled = !available.length || !signedInAccounts().length;
  $("add-rule").textContent = available.length ? "Add rule" : "All services have rules";
}

function renderRules() {
  const list = $("rules-list");
  const message = $("rules-state");
  list.textContent = "";
  $("rules-count").textContent = state.rules.length || "";
  renderRuleForm();

  message.hidden = state.rules.length > 0;
  message.textContent = signedInAccounts().length
    ? "No rules yet. Every service opens with your default account."
    : "Sign in to Google to add rules.";

  for (const rule of state.rules) {
    const service = ruleService(rule);
    const row = fromTemplate("rule-template");
    setAvatar(row.querySelector(".avatar"), service.img, service.title);
    row.querySelector(".row-title").textContent = service.title;
    row.title = service.url;

    const picker = createPicker({
      label: "Account",
      compact: true,
      onChange: (email) =>
        saveRules(
          state.rules.map((r) =>
            r.serviceUrl === rule.serviceUrl ? { ...r, ...buildRule(service, email), serviceName: r.serviceName } : r
          )
        ),
    });
    const email = ruleAccountEmail(rule);
    picker.setItems(accountItems(email), email);
    row.querySelector(".rule-account").replaceWith(picker.element);

    row.querySelector(".delete").addEventListener("click", () => {
      saveRules(state.rules.filter((r) => r.serviceUrl !== rule.serviceUrl));
    });
    list.append(row);
  }
}

function setupRuleForm() {
  servicePicker = createPicker({ label: "Service", searchPlaceholder: "Search services" });
  accountPicker = createPicker({ label: "Account" });
  $("service-picker").replaceWith(servicePicker.element);
  $("account-picker").replaceWith(accountPicker.element);

  $("rule-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const service = getServiceByUrl(servicePicker.value);
    if (!service || !accountPicker.value) return;
    saveRules([...state.rules, buildRule(service, accountPicker.value)]);
  });
}

/* ---------- Setup ---------- */

function render() {
  $("enabled").checked = state.enabled;
  $("paused-banner").hidden = state.enabled;
  renderAccounts();
  renderRules();
}

function loadState(callback) {
  SyncStorage.get(["enabled", "defaultAccount", "defaultAccountEmail", "rules", "accounts"], (sync) => {
    LocalStorage.get("accounts", (local) => {
      state.enabled = sync.enabled ?? true;
      state.defaultAccount = sync.defaultAccount ?? 0;
      state.defaultAccountEmail = sync.defaultAccountEmail;
      state.rules = sync.rules ?? [];
      state.accounts = local.accounts ?? sync.accounts ?? [];
      callback();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupRuleForm();

  $("enabled").addEventListener("change", (event) => {
    SyncStorage.store({ enabled: event.target.checked });
  });

  $("shortcuts-link").addEventListener("click", (event) => {
    event.preventDefault();
    const firefox = typeof browser !== "undefined" && navigator.userAgent.includes("Firefox");
    chrome.tabs.create({ url: firefox ? "about:addons" : "chrome://extensions/shortcuts" });
    window.close();
  });

  // render the cached state right away, then refresh the accounts
  loadState(() => {
    if (state.accounts.length) state.accountsStatus = "loaded";
    render();
    chrome.runtime.sendMessage("fetch_google_accounts", (accounts) => {
      void chrome.runtime.lastError;
      if (accounts) state.accounts = accounts;
      state.accountsStatus = accounts || state.accounts.length ? "loaded" : "error";
      render();
    });
  });

  chrome.storage.onChanged.addListener(() => loadState(render));
});
