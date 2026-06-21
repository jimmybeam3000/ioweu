const STORAGE_KEY = "ioweu-state-v2";
const LEGACY_STORAGE_KEY = "ioweu-data-v1";
const APP_VERSION = 1;
const VIEWS = ["start", "lend", "import", "profile"];

const state = loadState();
const uiState = {
  activeView: "start",
  currentDraftId: null,
  pendingImportCode: null,
  exportBundle: null,
  importMessage: "",
  lendMessage: "",
  lendKind: "money",
  lendRole: "lend",
  deferredPrompt: null,
};

const elements = {
  installButton: document.getElementById("install"),
  installBanner: document.getElementById("install-banner"),
  views: {
    start: document.getElementById("view-start"),
    lend: document.getElementById("view-lend"),
    import: document.getElementById("view-import"),
    profile: document.getElementById("view-profile"),
  },
};

initialize();

function initialize() {
  bindGlobalEvents();
  registerServiceWorker();
  render();
}

function bindGlobalEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    uiState.deferredPrompt = event;
    render();
  });
}

function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.action;
  if (action === "install") {
    promptInstall();
    return;
  }

  if (action === "copy-export") {
    copyExportText();
    return;
  }

  if (action === "choose-file") {
    document.getElementById("import-file").click();
    return;
  }

  if (action === "download-export") {
    downloadCurrentExport();
    return;
  }

  if (action === "share-export") {
    shareCurrentExport();
    return;
  }

  if (action === "open-decision") {
    uiState.pendingImportCode = actionButton.dataset.code;
    uiState.exportBundle = null;
    setView("import");
    render();
    return;
  }

  if (action === "discard-draft") {
    discardDraft(actionButton.dataset.id);
    return;
  }

  if (action === "export-draft") {
    exportDraft(actionButton.dataset.id);
    return;
  }

  if (action === "repeat-export") {
    repeatExport(actionButton.dataset.id);
    return;
  }

  if (action === "respond") {
    respondToRequest(actionButton.dataset.code, actionButton.dataset.decision);
  }
}

function handleSubmit(event) {
  if (event.target.id === "profile-form") {
    event.preventDefault();
    saveProfile(new FormData(event.target));
    return;
  }

  if (event.target.id === "lend-form") {
    event.preventDefault();
    generateDraft(new FormData(event.target));
    return;
  }

  if (event.target.id === "import-text-form") {
    event.preventDefault();
    const textarea = document.getElementById("import-text");
    importPacketText(textarea.value);
  }
}

function handleChange(event) {
  if (event.target.id === "kind") {
    uiState.lendKind = event.target.value === "item" ? "item" : "money";
    uiState.lendMessage = "";
    render();
    return;
  }

  if (event.target.id === "role") {
    uiState.lendRole = event.target.value === "borrow" ? "borrow" : "lend";
    uiState.lendMessage = "";
    render();
    return;
  }

  if (event.target.id === "import-file") {
    importFile(event.target.files[0]);
  }
}

function loadState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) {
    return normalizeState(current);
  }

  const legacy = safeParse(localStorage.getItem(LEGACY_STORAGE_KEY));
  if (legacy) {
    return migrateLegacyState(legacy);
  }

  return {
    profile: {
      id: generateId(),
      name: "",
      createdAt: isoNow(),
    },
    contacts: [],
    documents: [],
  };
}

function normalizeState(rawState) {
  return {
    profile: {
      id: rawState.profile?.id || generateId(),
      name: rawState.profile?.name || "",
      createdAt: rawState.profile?.createdAt || isoNow(),
    },
    contacts: Array.isArray(rawState.contacts) ? rawState.contacts : [],
    documents: Array.isArray(rawState.documents) ? rawState.documents : [],
  };
}

function migrateLegacyState(legacyState) {
  const profile = {
    id: legacyState.me?.id || generateId(),
    name: legacyState.me?.name || "",
    createdAt: isoNow(),
  };
  const contacts = Array.isArray(legacyState.people)
    ? legacyState.people.map((person) => ({
        id: person.id || generateId(),
        name: person.name || "Unbekannt",
      }))
    : [];
  const documents = Array.isArray(legacyState.tx)
    ? legacyState.tx.map(convertLegacyTransaction).filter(Boolean)
    : [];
  return { profile, contacts, documents };
}

function convertLegacyTransaction(transaction) {
  if (!transaction || (transaction.kind !== "money" && transaction.kind !== "item")) {
    return null;
  }

  return {
    id: transaction.id || generateId(),
    operationCode: buildLegacyOperationCode(transaction.id),
    kind: transaction.kind,
    direction: "legacy",
    lenderName: transaction.ownerName || transaction.creditor || "Unbekannt",
    recipientName: transaction.borrowerName || transaction.debtor || "Unbekannt",
    amount: transaction.kind === "money" ? Number(transaction.amount || 0) : null,
    itemName: transaction.kind === "item" ? transaction.item || "Gegenstand" : "",
    note: transaction.note || "",
    status: normalizeStatus(transaction.status),
    createdAt: transaction.date || isoNow(),
    updatedAt: transaction.date || isoNow(),
    source: "legacy",
    response: null,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderInstallState();
  renderTabs();
  renderStartView();
  renderLendView();
  renderImportView();
  renderProfileView();
  updateViewVisibility();
}

function renderInstallState() {
  const canPrompt = Boolean(uiState.deferredPrompt);
  elements.installButton.hidden = !canPrompt;
  elements.installButton.dataset.action = "install";

  const showBanner = !isStandaloneMode();
  if (!showBanner) {
    elements.installBanner.classList.add("hide");
    elements.installBanner.innerHTML = "";
    return;
  }

  elements.installBanner.classList.remove("hide");
  elements.installBanner.innerHTML = [
    "<strong>Startbildschirm</strong>",
    "<p class=\"hint\">Für die schnellste Offline-Nutzung: im Browser \"Zum Startbildschirm hinzufügen\" wählen.</p>",
  ].join("");
}

function renderTabs() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === uiState.activeView);
  });
}

function renderStartView() {
  const outgoingCount = state.documents.filter((document) => document.direction === "outgoing").length;
  const incomingCount = state.documents.filter((document) => document.direction === "incoming").length;
  const openCount = state.documents.filter((document) =>
    ["draft", "sent", "received"].includes(document.status)
  ).length;

  const historyItems = state.documents
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(renderDocumentCard)
    .join("");

  elements.views.start.innerHTML = `
    <section class="card hero">
      <div>
        <small>${state.profile.name ? `Aktiv als ${escapeHtml(state.profile.name)}` : "Profil noch offen"}</small>
        <h1>I owe U, ohne Server</h1>
        <p class="hint">Erzeuge eine Anfrage als <code>.iou</code> Datei oder importiere eine Antwort komplett offline.</p>
      </div>
      <div class="chip-row">
        <span class="chip">Static Pages</span>
        <span class="chip">Offline</span>
        <span class="chip">Keine Links</span>
        <span class="chip">.iou Dateien</span>
      </div>
      <div class="hero-grid">
        <div class="metric">
          <small>Ausgehend</small>
          <div class="metric-value">${outgoingCount}</div>
        </div>
        <div class="metric">
          <small>Eingehend</small>
          <div class="metric-value">${incomingCount}</div>
        </div>
        <div class="metric">
          <small>Offen</small>
          <div class="metric-value">${openCount}</div>
        </div>
        <div class="metric">
          <small>Kontakte</small>
          <div class="metric-value">${state.contacts.length}</div>
        </div>
      </div>
    </section>
    ${!state.profile.name ? renderOnboardingCard() : ""}
    <section class="card">
      <h2>Vorgänge</h2>
      ${
        historyItems ||
        "<div class=\"empty\">Noch keine Vorgänge. Starte mit \"Verleihen\" oder importiere eine erhaltene Datei.</div>"
      }
    </section>
  `;
}

function renderOnboardingCard() {
  return `
    <section class="card">
      <h2>Erststart</h2>
      <p class="hint">Trage deinen Namen ein, damit empfangene und gesendete <code>.iou</code> Dateien sauber signiert werden.</p>
      <form id="profile-form" class="stack">
        <div>
          <label for="profile-name-start">Dein Name</label>
          <input id="profile-name-start" name="profileName" autocomplete="name" placeholder="z.B. Max" required>
        </div>
        <button type="submit">Namen speichern</button>
      </form>
    </section>
  `;
}

function renderLendView() {
  const selectedKind = uiState.lendKind;
  const selectedRole = uiState.lendRole;
  const isBorrowFlow = selectedRole === "borrow";
  const ownName = state.profile.name || "Ich";
  const currentDraft = getCurrentDraft();
  const recipientSuggestions = state.contacts
    .map((contact) => `<option value="${escapeAttribute(contact.name)}"></option>`)
    .join("");
  const draftPreview = currentDraft
    ? `
      <section class="card">
        <h2>Vorgangscode erzeugt</h2>
        <div class="preview stack">
          <div class="route">${escapeHtml(currentDraft.lenderName)} → ${escapeHtml(currentDraft.recipientName)}</div>
          <div class="value-line">${renderValueLine(currentDraft)}</div>
          <span class="code">${escapeHtml(currentDraft.operationCode)}</span>
          <small>${currentDraft.kind === "money" ? "Geldanfrage" : "Gegenstandsanfrage"} bereit zum Export.</small>
        </div>
        <div class="actions">
          <button type="button" data-action="export-draft" data-id="${escapeAttribute(currentDraft.id)}">Exportieren &amp; Versenden</button>
          <button type="button" class="ghost" data-action="discard-draft" data-id="${escapeAttribute(currentDraft.id)}">Verwerfen</button>
        </div>
      </section>
    `
    : "";

  elements.views.lend.innerHTML = `
    <section class="card">
      <h2>${isBorrowFlow ? "Ich leihe mir etwas" : "Ich verleihe etwas"}</h2>
      <p class="hint">1. Art wählen. 2. Empfänger eintragen. 3. Betrag oder Gegenstand erfassen. 4. Vorgangscode erzeugen.</p>
      <div class="step-grid">
        <div class="step-card"><strong>1</strong><span>Richtung</span></div>
        <div class="step-card"><strong>2</strong><span>Art</span></div>
        <div class="step-card"><strong>3</strong><span>Wert</span></div>
        <div class="step-card"><strong>4</strong><span>Export</span></div>
      </div>
      <form id="lend-form" class="stack">
        <div>
          <label for="role">Richtung</label>
          <select id="role" name="role">
            <option value="lend"${selectedRole === "lend" ? " selected" : ""}>Ich verleihe</option>
            <option value="borrow"${selectedRole === "borrow" ? " selected" : ""}>Ich leihe mir</option>
          </select>
        </div>
        <div>
          <label for="kind">Art</label>
          <select id="kind" name="kind">
            <option value="money"${selectedKind === "money" ? " selected" : ""}>Geld</option>
            <option value="item"${selectedKind === "item" ? " selected" : ""}>Gegenstand</option>
          </select>
        </div>
        <div class="row">
          <div>
            <label for="partner-name">${isBorrowFlow ? "Verleihername" : "Verleiher"}</label>
            <input id="partner-name" name="partnerName" list="contact-suggestions" placeholder="z.B. David" value="${isBorrowFlow ? "" : escapeAttribute(ownName)}" ${isBorrowFlow ? "required" : "readonly"}>
          </div>
          <div>
            <label for="counterparty-name">${isBorrowFlow ? "Empfänger" : "Empfängername"}</label>
            <input id="counterparty-name" name="counterpartyName" list="contact-suggestions" placeholder="${escapeAttribute(isBorrowFlow ? ownName : "z.B. David")}" value="${isBorrowFlow ? escapeAttribute(ownName) : ""}" ${isBorrowFlow ? "readonly" : "required"}>
          </div>
        </div>
        <datalist id="contact-suggestions">${recipientSuggestions}</datalist>
        <div class="row">
          <div class="${selectedKind === "item" ? "hide" : ""}">
            <label for="amount">Betrag in EUR</label>
            <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="25.00">
          </div>
          <div class="${selectedKind === "money" ? "hide" : ""}">
            <label for="item-name">Gegenstand</label>
            <input id="item-name" name="itemName" placeholder="z.B. Kamera">
          </div>
        </div>
        <div class="mode-callout">
          <strong>${selectedKind === "money" ? "Geldfluss" : "Gegenstandsfluss"}</strong>
          <span>${isBorrowFlow ? "Andere Person → Ich" : `${escapeHtml(ownName)} → Empfänger`}</span>
        </div>
        <div>
          <label for="note">Notiz</label>
          <input id="note" name="note" maxlength="160" placeholder="Optional">
        </div>
        <button type="submit">Vorgangscode erzeugen</button>
      </form>
      ${uiState.lendMessage ? `<p class="inline-message error">${escapeHtml(uiState.lendMessage)}</p>` : ""}
    </section>
    ${draftPreview}
    ${renderExportCard()}
  `;
}

function renderImportView() {
  const pendingDocument = getPendingImportDocument();
  const importReview = pendingDocument
    ? `
      <section class="card">
        <h2>Vorgang prüfen</h2>
        <div class="preview stack">
          <div class="route">${escapeHtml(pendingDocument.lenderName)} → ${escapeHtml(pendingDocument.recipientName)}</div>
          <div class="value-line">${renderValueLine(pendingDocument)}</div>
          <span class="code">${escapeHtml(pendingDocument.operationCode)}</span>
          <small>${escapeHtml(pendingDocument.note || "Keine Zusatznotiz")}</small>
        </div>
        <div class="actions">
          <button type="button" data-action="respond" data-decision="accepted" data-code="${escapeAttribute(
            pendingDocument.operationCode
          )}">Bestätigen</button>
          <button type="button" class="danger" data-action="respond" data-decision="rejected" data-code="${escapeAttribute(
            pendingDocument.operationCode
          )}">Ablehnen</button>
        </div>
      </section>
    `
    : "";

  elements.views.import.innerHTML = `
    <section class="card">
      <h2>Empfänger</h2>
      <p class="hint">Akzeptiert <code>.iou</code>, <code>.iou.txt</code> und <code>.txt</code>. Anfrage importieren, prüfen und als Antwort wieder exportieren.</p>
      <div class="import-card">
        <strong>Datei erhalten?</strong>
        <span>Einfach importieren, prüfen und direkt als Antwortdatei zurückschicken.</span>
      </div>
      <form id="import-text-form" class="stack">
        <div>
          <label for="import-text">IOU-Inhalt einfügen</label>
          <textarea id="import-text" placeholder="Dateiinhalt hier einfügen"></textarea>
        </div>
        <div class="actions">
          <button type="submit">Importieren</button>
          <button type="button" class="ghost" data-action="choose-file">Datei wählen</button>
        </div>
        <input id="import-file" type="file" accept=".iou,.iou.txt,.txt,text/plain" hidden>
      </form>
      ${uiState.importMessage ? `<p class="inline-message success">${escapeHtml(uiState.importMessage)}</p>` : ""}
    </section>
    ${pendingDocument ? importReview : ""}
    ${renderExportCard()}
  `;
}

function renderProfileView() {
  const contactList = state.contacts
    .map((contact) => `<div class="item"><strong>${escapeHtml(contact.name)}</strong></div>`)
    .join("");
  elements.views.profile.innerHTML = `
    <section class="card">
      <h2>Profil</h2>
      <form id="profile-form" class="stack">
        <div>
          <label for="profile-name">Dein Name</label>
          <input id="profile-name" name="profileName" value="${escapeAttribute(
            state.profile.name
          )}" autocomplete="name" placeholder="z.B. Max" required>
        </div>
        <div>
          <small>ID</small>
          <div class="code">${escapeHtml(state.profile.id)}</div>
        </div>
        <button type="submit">Profil speichern</button>
      </form>
    </section>
    <section class="card">
      <h2>Kontakte</h2>
      ${
        contactList ||
        "<div class=\"empty\">Noch keine Kontakte gespeichert. Neue Namen werden beim Export oder Import automatisch gemerkt.</div>"
      }
    </section>
  `;
}

function renderDocumentCard(document) {
  const actionButtons = [];
  if (document.status === "draft") {
    actionButtons.push(
      `<button type="button" data-action="export-draft" data-id="${escapeAttribute(document.id)}">Exportieren &amp; Versenden</button>`
    );
    actionButtons.push(
      `<button type="button" class="ghost" data-action="discard-draft" data-id="${escapeAttribute(document.id)}">Verwerfen</button>`
    );
  }
  if (document.direction === "outgoing" && ["sent", "accepted", "rejected"].includes(document.status)) {
    actionButtons.push(
      `<button type="button" class="ghost" data-action="repeat-export" data-id="${escapeAttribute(document.id)}">.iou erneut exportieren</button>`
    );
  }
  if (document.direction === "incoming" && document.status === "received") {
    actionButtons.push(
      `<button type="button" data-action="open-decision" data-code="${escapeAttribute(
        document.operationCode
      )}">Prüfen &amp; antworten</button>`
    );
  }

  return `
    <article class="item">
      <div class="item-head">
        <div>
          <div class="route">${escapeHtml(document.lenderName)} → ${escapeHtml(document.recipientName)}</div>
          <div class="value-line">${renderValueLine(document)}</div>
          <span class="code">${escapeHtml(document.operationCode)}</span>
        </div>
        <span class="${statusClass(document.status)}">${escapeHtml(statusLabel(document.status))}</span>
      </div>
      <small>${escapeHtml(formatDate(document.updatedAt))}</small>
      ${document.note ? `<p class="hint">${escapeHtml(document.note)}</p>` : ""}
      ${document.response ? `<small>Antwort von ${escapeHtml(document.response.responderName)} am ${escapeHtml(formatDate(document.response.respondedAt))}</small>` : ""}
      ${actionButtons.length ? `<div class="actions">${actionButtons.join("")}</div>` : ""}
    </article>
  `;
}

function renderValueLine(document) {
  if (document.kind === "money") {
    return `${formatMoney(document.amount)}`;
  }
  return escapeHtml(document.itemName || "Gegenstand");
}

function renderExportCard() {
  if (!uiState.exportBundle) {
    return "";
  }

  return `
    <section class="card">
      <h2>${escapeHtml(uiState.exportBundle.title)}</h2>
      <p class="hint">Die Datei bleibt lokal. Du kannst sie direkt teilen oder herunterladen und dann über WhatsApp, Signal, Telegram oder Mail versenden.</p>
      <div class="import-card">
        <strong>${escapeHtml(uiState.exportBundle.fileName)}</strong>
        <span>Exportiert als reine Textdatei mit der Endung <code>.iou</code>.</span>
      </div>
      <div class="actions">
        <button type="button" data-action="share-export">Exportieren &amp; Versenden</button>
        <button type="button" class="ghost" data-action="download-export">Datei herunterladen</button>
        <button type="button" class="secondary" data-action="copy-export">In Zwischenablage</button>
      </div>
      <pre class="export-box">${escapeHtml(uiState.exportBundle.text)}</pre>
    </section>
  `;
}

function updateViewVisibility() {
  VIEWS.forEach((view) => {
    elements.views[view].classList.toggle("hide", view !== uiState.activeView);
  });
}

function setView(view) {
  if (!VIEWS.includes(view)) {
    return;
  }
  uiState.activeView = view;
  render();
}

function saveProfile(formData) {
  const profileName = String(formData.get("profileName") || "").trim();
  if (!profileName) {
    uiState.importMessage = "Bitte einen Namen eintragen.";
    render();
    return;
  }

  state.profile.name = profileName;
  saveState();
  uiState.importMessage = "";
  render();
}

function generateDraft(formData) {
  if (!requireProfileName()) {
    setView("profile");
    return;
  }

  const draft = buildDraft(formData);
  if (!draft) {
    render();
    return;
  }

  const existingDraftIndex = state.documents.findIndex((document) => document.id === uiState.currentDraftId);
  if (existingDraftIndex >= 0) {
    state.documents[existingDraftIndex] = draft;
  } else {
    state.documents.push(draft);
  }

  uiState.currentDraftId = draft.id;
  uiState.exportBundle = null;
  saveContactName(draft.lenderName);
  saveContactName(draft.recipientName);
  saveState();
  render();
}

function buildDraft(formData) {
  const kind = String(formData.get("kind") || "money");
  const role = String(formData.get("role") || "lend");
  const partnerName = String(formData.get("partnerName") || "").trim();
  const counterpartyName = String(formData.get("counterpartyName") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const itemName = String(formData.get("itemName") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const isBorrowFlow = role === "borrow";
  const lenderName = isBorrowFlow ? partnerName : state.profile.name;
  const recipientName = isBorrowFlow ? state.profile.name : counterpartyName;

  if (!lenderName) {
    uiState.lendMessage = isBorrowFlow ? "Verleihername fehlt." : "Dein Profilname fehlt.";
    return null;
  }
  if (!recipientName) {
    uiState.lendMessage = isBorrowFlow ? "Dein Profilname fehlt." : "Empfängername fehlt.";
    return null;
  }
  if (kind === "money" && amount <= 0) {
    uiState.lendMessage = "Bitte einen Geldbetrag größer als 0 eingeben.";
    return null;
  }
  if (kind === "item" && !itemName) {
    uiState.lendMessage = "Bitte einen Gegenstand eintragen.";
    return null;
  }

  uiState.lendMessage = "";
  return {
    id: uiState.currentDraftId || generateId(),
    operationCode: generateOperationCode(),
    kind,
    direction: "outgoing",
    role,
    lenderName,
    recipientName,
    amount: kind === "money" ? amount : null,
    itemName: kind === "item" ? itemName : "",
    note,
    status: "draft",
    createdAt: isoNow(),
    updatedAt: isoNow(),
    source: "local",
    response: null,
  };
}

function exportDraft(documentId) {
  const document = state.documents.find((entry) => entry.id === documentId);
  if (!document) {
    return;
  }

  document.status = "sent";
  document.updatedAt = isoNow();
  uiState.currentDraftId = null;
  uiState.exportBundle = buildExportBundle(buildRequestPacket(document), document.operationCode, "Anfrage exportieren");
  saveState();
  render();
  shareCurrentExport();
}

function repeatExport(documentId) {
  const document = state.documents.find((entry) => entry.id === documentId);
  if (!document) {
    return;
  }

  const packet =
    document.response && document.direction === "incoming"
      ? buildResponsePacket(document)
      : buildRequestPacket(document);
  const title = document.response ? "Antwort exportieren" : "Anfrage exportieren";
  uiState.exportBundle = buildExportBundle(packet, document.operationCode, title);
  render();
}

function discardDraft(documentId) {
  state.documents = state.documents.filter((document) => document.id !== documentId);
  if (uiState.currentDraftId === documentId) {
    uiState.currentDraftId = null;
  }
  uiState.exportBundle = null;
  saveState();
  render();
}

function importPacketText(text) {
  const trimmedText = String(text || "").trim();
  if (!trimmedText) {
    uiState.importMessage = "Bitte eine Datei wählen oder IOU-Inhalt einfügen.";
    render();
    return;
  }

  try {
    const normalized = normalizeImportedPacket(trimmedText);
    if (normalized.documentType === "request") {
      const importedDocument = upsertIncomingRequest(normalized);
      uiState.pendingImportCode = importedDocument.operationCode;
      uiState.importMessage = `Anfrage ${importedDocument.operationCode} importiert.`;
    } else if (normalized.documentType === "response") {
      mergeIncomingResponse(normalized);
      uiState.importMessage = `Antwort ${normalized.operationCode} importiert.`;
    }
    uiState.exportBundle = null;
    saveState();
    render();
  } catch (error) {
    uiState.importMessage = "Import fehlgeschlagen. Dateiinhalt prüfen.";
    render();
  }
}

function importFile(file) {
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => importPacketText(String(reader.result || ""));
  reader.readAsText(file);
}

function upsertIncomingRequest(packet) {
  saveContactName(packet.lender.name);
  saveContactName(packet.recipient.name);

  const existing = state.documents.find((document) => document.operationCode === packet.operationCode);
  const importedDocument = {
    id: existing?.id || generateId(),
    operationCode: packet.operationCode,
    kind: packet.kind,
    direction: "incoming",
    lenderName: packet.lender.name,
    recipientName: packet.recipient.name,
    amount: packet.amount ?? null,
    itemName: packet.itemName || "",
    note: packet.note || "",
    status: existing?.status === "accepted" || existing?.status === "rejected" ? existing.status : "received",
    createdAt: packet.createdAt || isoNow(),
    updatedAt: isoNow(),
    source: "imported",
    response: existing?.response || null,
  };

  if (existing) {
    Object.assign(existing, importedDocument);
    return existing;
  }

  state.documents.push(importedDocument);
  return importedDocument;
}

function mergeIncomingResponse(packet) {
  saveContactName(packet.responder.name);
  const matchingDocument = state.documents.find((document) => document.operationCode === packet.operationCode);

  if (matchingDocument) {
    matchingDocument.status = packet.decision;
    matchingDocument.updatedAt = isoNow();
    matchingDocument.response = {
      status: packet.decision,
      responderName: packet.responder.name,
      responderId: packet.responder.id || "",
      respondedAt: packet.respondedAt || isoNow(),
    };
    return;
  }

  state.documents.push({
    id: generateId(),
    operationCode: packet.operationCode,
    kind: packet.kind || "money",
    direction: "incoming",
    lenderName: packet.lender?.name || "Unbekannt",
    recipientName: packet.recipient?.name || state.profile.name || "Unbekannt",
    amount: packet.amount ?? null,
    itemName: packet.itemName || "",
    note: packet.note || "",
    status: packet.decision,
    createdAt: packet.createdAt || isoNow(),
    updatedAt: isoNow(),
    source: "imported-response",
    response: {
      status: packet.decision,
      responderName: packet.responder.name,
      responderId: packet.responder.id || "",
      respondedAt: packet.respondedAt || isoNow(),
    },
  });
}

function respondToRequest(operationCode, decision) {
  if (!requireProfileName()) {
    setView("profile");
    return;
  }

  const document = state.documents.find((entry) => entry.operationCode === operationCode);
  if (!document) {
    return;
  }

  document.status = decision;
  document.updatedAt = isoNow();
  document.response = {
    status: decision,
    responderName: state.profile.name,
    responderId: state.profile.id,
    respondedAt: isoNow(),
  };

  uiState.pendingImportCode = null;
  uiState.exportBundle = buildExportBundle(buildResponsePacket(document), document.operationCode, "Antwort exportieren");
  saveState();
  render();
  shareCurrentExport();
}

function buildRequestPacket(document) {
  return {
    format: "ioweu.iou",
    version: APP_VERSION,
    documentType: "request",
    operationCode: document.operationCode,
    kind: document.kind,
    lender: {
      id: state.profile.id,
      name: document.lenderName,
    },
    recipient: {
      name: document.recipientName,
    },
    amount: document.amount,
    itemName: document.itemName,
    note: document.note,
    createdAt: document.createdAt,
  };
}

function buildResponsePacket(document) {
  return {
    format: "ioweu.iou",
    version: APP_VERSION,
    documentType: "response",
    operationCode: document.operationCode,
    kind: document.kind,
    lender: {
      name: document.lenderName,
    },
    recipient: {
      name: document.recipientName,
    },
    amount: document.amount,
    itemName: document.itemName,
    note: document.note,
    createdAt: document.createdAt,
    decision: document.response?.status || document.status,
    responder: {
      id: state.profile.id,
      name: state.profile.name,
    },
    respondedAt: document.response?.respondedAt || isoNow(),
  };
}

function normalizeImportedPacket(rawText) {
  const parsed = parsePacket(rawText);

  if (parsed.format === "ioweu.iou" && parsed.version === APP_VERSION) {
    return parsed;
  }

  if (parsed.type === "tx") {
    return {
      format: "ioweu.iou",
      version: APP_VERSION,
      documentType: "request",
      operationCode: buildLegacyOperationCode(parsed.tx?.id),
      kind: parsed.tx?.kind === "item" ? "item" : "money",
      lender: {
        name: parsed.tx?.owner || parsed.tx?.creditor || "Unbekannt",
      },
      recipient: {
        name: parsed.tx?.borrower || parsed.tx?.debtor || "Unbekannt",
      },
      amount: Number(parsed.tx?.amount || 0),
      itemName: parsed.tx?.item || "",
      note: parsed.tx?.note || "",
      createdAt: parsed.tx?.date || isoNow(),
    };
  }

  throw new Error("unsupported packet");
}

function parsePacket(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  if (trimmed.startsWith("IOWEU:")) {
    const base64 = trimmed.slice("IOWEU:".length);
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  }

  throw new Error("unknown packet format");
}

function buildExportBundle(packet, operationCode, title) {
  return {
    title,
    fileName: `ioweu-${operationCode.toLowerCase()}.iou`,
    text: JSON.stringify(packet, null, 2),
  };
}

async function shareCurrentExport() {
  if (!uiState.exportBundle) {
    return;
  }

  const file = new File([uiState.exportBundle.text], uiState.exportBundle.fileName, {
    type: "text/plain",
  });

  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "IoweU",
        text: "IOU-Datei",
        files: [file],
      });
      return;
    }
  } catch (error) {
    // Fallback below.
  }

  downloadCurrentExport();
}

function downloadCurrentExport() {
  if (!uiState.exportBundle) {
    return;
  }
  const blob = new Blob([uiState.exportBundle.text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = uiState.exportBundle.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyExportText() {
  if (!uiState.exportBundle) {
    return;
  }
  await navigator.clipboard.writeText(uiState.exportBundle.text);
}

async function promptInstall() {
  if (!uiState.deferredPrompt) {
    return;
  }
  await uiState.deferredPrompt.prompt();
  uiState.deferredPrompt = null;
  render();
}

function requireProfileName() {
  return Boolean(state.profile.name.trim());
}

function getCurrentDraft() {
  if (!uiState.currentDraftId) {
    return null;
  }
  const draft = state.documents.find((document) => document.id === uiState.currentDraftId) || null;
  return draft?.status === "draft" ? draft : null;
}

function getPendingImportDocument() {
  if (!uiState.pendingImportCode) {
    return null;
  }
  return state.documents.find((document) => document.operationCode === uiState.pendingImportCode) || null;
}

function saveContactName(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    return;
  }
  const exists = state.contacts.some(
    (contact) => contact.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (!exists) {
    state.contacts.push({
      id: generateId(),
      name: cleanName,
    });
  }
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status) {
  if (status === "draft") return "Entwurf";
  if (status === "sent") return "Versendet";
  if (status === "received") return "Empfangen";
  if (status === "accepted") return "Bestätigt";
  if (status === "rejected") return "Abgelehnt";
  return status;
}

function statusClass(status) {
  if (status === "accepted") return "pill ok";
  if (status === "rejected") return "pill bad";
  return "pill info";
}

function normalizeStatus(status) {
  if (status === "confirmed") return "accepted";
  if (status === "rejected") return "rejected";
  return "sent";
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function generateOperationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function buildLegacyOperationCode(seed) {
  return String(seed || generateOperationCode()).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || generateOperationCode();
}

function isoNow() {
  return new Date().toISOString();
}

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
