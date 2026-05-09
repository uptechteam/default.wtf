// Profiles manager — rendered inside settings overlay when profiles section is opened

function renderProfilesManager() {
  const container = document.getElementById("profiles-manager");
  if (!container) return;
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "profile-list";

  for (const profile of App.profiles) {
    list.appendChild(makeProfileCard(profile));
  }
  container.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.className = "settings-btn add-profile-btn";
  addBtn.textContent = "+ New profile";
  addBtn.onclick = () => showCreateProfileModal();
  container.appendChild(addBtn);
}

function makeProfileCard(profile) {
  const isDefault = profile.id === DEFAULT_PROFILE_ID;
  const isActive  = profile.id === App.activeProfileId;

  const card = document.createElement("div");
  card.className = "profile-card" + (isActive ? " profile-card--active" : "");

  // Left: color dot
  const dot = document.createElement("span");
  dot.className = "profile-dot";
  dot.style.background = profile.color;
  card.appendChild(dot);

  // Center: name + meta
  const info = document.createElement("div");
  info.className = "profile-card-info";

  const nameRow = document.createElement("div");
  nameRow.className = "profile-card-name-row";
  const name = document.createElement("span");
  name.className = "profile-card-name";
  name.textContent = profile.name;
  nameRow.appendChild(name);

  if (isActive) {
    const badge = document.createElement("span");
    badge.className = "profile-badge profile-badge--active";
    badge.textContent = "active";
    nameRow.appendChild(badge);
  }
  if (isDefault) {
    const badge = document.createElement("span");
    badge.className = "profile-badge profile-badge--default";
    badge.textContent = "default";
    nameRow.appendChild(badge);
  }
  info.appendChild(nameRow);

  // Meta: default account + rule count
  const meta = document.createElement("div");
  meta.className = "profile-card-meta";
  const defAcct = profile.defaultAccount ?? 0;
  const acctInfo = App.accounts[defAcct];
  const n = (profile.rules ?? []).length;
  meta.textContent = (acctInfo ? acctInfo.email : `Account #${defAcct + 1}`)
    + " · " + (n === 0 ? "no rules" : `${n} rule${n > 1 ? "s" : ""}`);
  info.appendChild(meta);

  card.appendChild(info);

  // Right: actions
  const actions = document.createElement("div");
  actions.className = "profile-card-actions";

  if (!isActive) {
    const activateBtn = document.createElement("button");
    activateBtn.className = "profile-action-btn profile-action-btn--activate";
    activateBtn.textContent = "Activate";
    activateBtn.onclick = (e) => {
      e.stopPropagation();
      switchActiveProfile(profile.id);
    };
    actions.appendChild(activateBtn);
  }

  const editBtn = document.createElement("button");
  editBtn.className = "profile-action-btn";
  editBtn.textContent = "Edit";
  editBtn.onclick = (e) => {
    e.stopPropagation();
    showEditProfileModal(profile);
  };
  actions.appendChild(editBtn);

  const dupBtn = document.createElement("button");
  dupBtn.className = "profile-action-btn";
  dupBtn.textContent = "Duplicate";
  dupBtn.onclick = (e) => {
    e.stopPropagation();
    duplicateProfile(profile);
  };
  actions.appendChild(dupBtn);

  if (!isDefault) {
    const delBtn = document.createElement("button");
    delBtn.className = "profile-action-btn profile-action-btn--delete";
    delBtn.textContent = "Delete";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteProfile(profile.id);
    };
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  return card;
}

// ─── Create profile modal ────────────────────────────────────────────────────

function showCreateProfileModal() {
  document.getElementById("modal-title").textContent = "New Profile";
  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = "";
  openProfileModal();

  const form = buildProfileForm({
    name: "",
    color: PROFILE_COLORS[App.profiles.length % PROFILE_COLORS.length],
    defaultAccount: 0,
    onSave: (name, color, defaultAccount) => {
      const newProfile = makeProfile(name, color, { defaultAccount });
      App.profiles.push(newProfile);
      App.saveProfiles(() => {
        closeProfileModal();
        renderProfilesManager();
        renderProfileBar();
        window.dispatchEvent(new CustomEvent("app:updated"));
      });
    },
    onCancel: closeProfileModal,
  });
  modalBody.appendChild(form);
}

// ─── Edit profile modal ──────────────────────────────────────────────────────

function showEditProfileModal(profile) {
  document.getElementById("modal-title").textContent = `Edit: ${profile.name}`;
  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = "";
  openProfileModal();

  const form = buildProfileForm({
    name: profile.name,
    color: profile.color,
    defaultAccount: profile.defaultAccount ?? 0,
    isDefault: profile.id === DEFAULT_PROFILE_ID,
    onSave: (name, color, defaultAccount) => {
      profile.name = name;
      profile.color = color;
      profile.defaultAccount = defaultAccount;
      App.saveProfiles(() => {
        closeProfileModal();
        renderProfilesManager();
        renderProfileBar();
        renderRulesSummary();
        window.dispatchEvent(new CustomEvent("app:updated"));
      });
    },
    onCancel: closeProfileModal,
  });
  modalBody.appendChild(form);
}

// ─── Shared form builder ──────────────────────────────────────────────────────

function buildProfileForm({ name, color, defaultAccount, isDefault, onSave, onCancel }) {
  const form = document.createElement("div");
  form.className = "profile-form";

  // Name
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name:";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = name;
  nameInput.placeholder = "Profile name";
  nameInput.className = "profile-form-input";
  nameInput.disabled = isDefault;
  form.appendChild(nameLabel);
  form.appendChild(nameInput);

  // Color
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "Color:";
  const colorRow = document.createElement("div");
  colorRow.className = "color-picker-row";
  let selectedColor = color;
  for (const c of PROFILE_COLORS) {
    const swatch = document.createElement("button");
    swatch.className = "color-swatch" + (c === selectedColor ? " selected" : "");
    swatch.style.background = c;
    swatch.onclick = () => {
      selectedColor = c;
      colorRow.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      swatch.classList.add("selected");
    };
    colorRow.appendChild(swatch);
  }
  form.appendChild(colorLabel);
  form.appendChild(colorRow);

  // Default account
  const acctLabel = document.createElement("label");
  acctLabel.textContent = "Default account:";
  const acctSelect = document.createElement("select");
  acctSelect.className = "profile-form-select";
  let selectedDefaultAccount = defaultAccount ?? 0;

  if (App.accounts.length) {
    for (const a of App.accounts) {
      const opt = document.createElement("option");
      opt.value = a.index;
      opt.textContent = `${a.index + 1}) ${a.email}`;
      if (a.index === selectedDefaultAccount) opt.selected = true;
      acctSelect.appendChild(opt);
    }
  } else {
    const opt = document.createElement("option");
    opt.value = "0";
    opt.textContent = "Open a Google page to detect accounts";
    opt.disabled = true;
    opt.selected = true;
    acctSelect.appendChild(opt);
  }
  acctSelect.onchange = () => { selectedDefaultAccount = parseInt(acctSelect.value) || 0; };
  form.appendChild(acctLabel);
  form.appendChild(acctSelect);

  // Buttons
  const btnRow = document.createElement("div");
  btnRow.className = "profile-form-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.className = "settings-btn";
  saveBtn.textContent = "Save";
  saveBtn.onclick = () => {
    const n = nameInput.value.trim();
    if (!n) { nameInput.focus(); return; }
    onSave(isDefault ? "Default" : n, selectedColor, selectedDefaultAccount);
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "settings-btn settings-btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = onCancel;

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  return form;
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

function duplicateProfile(profile) {
  const copy = makeProfile(
    `${profile.name} (copy)`,
    PROFILE_COLORS[App.profiles.length % PROFILE_COLORS.length],
    {
      defaultAccount: profile.defaultAccount,
      rules: JSON.parse(JSON.stringify(profile.rules ?? [])),
      customServices: JSON.parse(JSON.stringify(profile.customServices ?? [])),
    }
  );
  App.profiles.push(copy);
  App.saveProfiles(() => {
    renderProfilesManager();
    renderProfileBar();
    window.dispatchEvent(new CustomEvent("app:updated"));
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function deleteProfile(profileId) {
  if (!confirm("Delete this profile? Its rules will be removed.")) return;
  App.profiles = App.profiles.filter(p => p.id !== profileId);
  if (App.activeProfileId === profileId) {
    App.activeProfileId = DEFAULT_PROFILE_ID;
    App.viewedProfileId = DEFAULT_PROFILE_ID;
    chrome.runtime.sendMessage({ type: "set_active_profile", profileId: DEFAULT_PROFILE_ID, redirectTabs: false });
  }
  App.saveProfiles(() => {
    renderProfilesManager();
    renderProfileBar();
    renderRulesSummary();
    window.dispatchEvent(new CustomEvent("app:updated"));
  });
}

// ─── Listen for updates ──────────────────────────────────────────────────────

window.addEventListener("app:updated", () => {
  if (document.getElementById("profiles-manager")) renderProfilesManager();
});
