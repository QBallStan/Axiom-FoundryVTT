const CURRENCY_SYMBOLS = {
  "": "AXIOM.Currency.Symbols.None",
  "$": "$",
  "€": "€",
  "£": "£",
  "¥": "¥",
  "₩": "₩",
  "₹": "₹",
  "₽": "₽",
  "₺": "₺",
  "₴": "₴",
  "₪": "₪",
  "₫": "₫",
  "₱": "₱",
  "฿": "฿",
  "₦": "₦",
  "₡": "₡",
  "₲": "₲",
  "₵": "₵",
  "₸": "₸",
  "₭": "₭",
  "₮": "₮",
  "₼": "₼",
  "₾": "₾",
  "₿": "₿",
  "¤": "¤",
  "¢": "¢",
  "USD": "USD",
  "CAD": "CAD",
  "AUD": "AUD",
  "NZD": "NZD",
  "EUR": "EUR",
  "GBP": "GBP",
  "JPY": "JPY",
  "CNY": "CNY",
  "CHF": "CHF",
  "SEK": "SEK",
  "NOK": "NOK",
  "DKK": "DKK",
  "PLN": "PLN",
  "CZK": "CZK",
  "HUF": "HUF",
  "BRL": "BRL",
  "MXN": "MXN",
  "ZAR": "ZAR",
  "KRW": "KRW",
  "INR": "INR",
  "RUB": "RUB",
  "TRY": "TRY"
};

function renderOpenSheets() {
  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.document?.documentName === "Actor" || app?.document?.documentName === "Item") app.render(false);
  }
}

function getSettingsConfigElement(html, app) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function getSettingRow(input) {
  return input?.closest(".form-group, .form-fields, fieldset, li") ?? input?.parentElement ?? null;
}

function insertCurrencyRefreshNotice(modeRow) {
  if (!modeRow) return;

  const existingNote = modeRow.parentElement?.querySelector(":scope > .axiom-currency-refresh-note");
  if (existingNote) {
    if (existingNote.previousElementSibling !== modeRow) modeRow.after(existingNote);
    return;
  }

  const nestedNote = modeRow.querySelector(".axiom-currency-refresh-note");
  if (nestedNote) {
    modeRow.after(nestedNote);
    return;
  }

  const note = document.createElement("p");
  note.className = "notes axiom-currency-refresh-note";
  note.textContent = game.i18n.localize("AXIOM.Settings.CurrencyMode.RefreshNote");
  modeRow.after(note);
}

function updateStandardCurrencySettingVisibility(root) {
  const modeInput = root.querySelector('[name="axiom.currencyMode"]');
  const standardSettingRows = [
    root.querySelector('[name="axiom.standardCurrencyName"]'),
    root.querySelector('[name="axiom.standardCurrencySymbol"]')
  ].map(getSettingRow).filter(Boolean);

  if (!modeInput || !standardSettingRows.length) return;

  insertCurrencyRefreshNotice(getSettingRow(modeInput));

  const syncVisibility = () => {
    const showStandardSettings = modeInput.value !== "fantasy";
    for (const row of standardSettingRows) {
      row.classList.toggle("axiom-hidden-setting", !showStandardSettings);
      row.hidden = !showStandardSettings;
    }
  };

  modeInput.addEventListener("change", syncVisibility);
  syncVisibility();
}

export function registerAxiomSettings() {
  game.settings.register("axiom", "currencyMode", {
    name: "AXIOM.Settings.CurrencyMode.Name",
    hint: "AXIOM.Settings.CurrencyMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      standard: "AXIOM.Settings.CurrencyMode.Standard",
      fantasy: "AXIOM.Settings.CurrencyMode.Fantasy"
    },
    default: "standard",
    requiresReload: true,
    onChange: renderOpenSheets
  });

  game.settings.register("axiom", "standardCurrencyName", {
    name: "AXIOM.Settings.StandardCurrencyName.Name",
    hint: "AXIOM.Settings.StandardCurrencyName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Credits",
    onChange: renderOpenSheets
  });

  game.settings.register("axiom", "standardCurrencySymbol", {
    name: "AXIOM.Settings.StandardCurrencySymbol.Name",
    hint: "AXIOM.Settings.StandardCurrencySymbol.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: CURRENCY_SYMBOLS,
    default: "$",
    onChange: renderOpenSheets
  });

  game.settings.register("axiom", "dodgeSkillName", {
    name: "AXIOM.Settings.DodgeSkillName.Name",
    hint: "AXIOM.Settings.DodgeSkillName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Dodge"
  });

  game.settings.register("axiom", "unarmedCombatSkillName", {
    name: "AXIOM.Settings.UnarmedCombatSkillName.Name",
    hint: "AXIOM.Settings.UnarmedCombatSkillName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Melee"
  });

  Hooks.on("renderSettingsConfig", (app, html) => {
    const root = getSettingsConfigElement(html, app);
    if (root) updateStandardCurrencySettingVisibility(root);
  });
}
