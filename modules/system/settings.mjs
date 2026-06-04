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

function isItemCompendium(pack) {
  const type = pack?.documentName ?? pack?.metadata?.type ?? pack?.metadata?.documentName;
  return String(type ?? "").toLowerCase() === "item";
}

function getItemCompendiumChoices() {
  const choices = { "": "AXIOM.Settings.NewProtagonistItemCompendium.None" };
  const packs = Array.from(game.packs?.values?.() ?? game.packs ?? [])
    .filter(isItemCompendium)
    .sort((a, b) => (a.metadata?.label ?? a.collection).localeCompare(b.metadata?.label ?? b.collection));

  for (const pack of packs) {
    choices[pack.collection] = pack.metadata?.label ?? pack.collection;
  }

  return choices;
}

function refreshNewActorCoreSkillCompendiumChoices() {
  const setting = game.settings?.settings?.get?.("axiom.newProtagonistItemCompendium");
  if (setting) setting.choices = getItemCompendiumChoices();
}

function updateNewActorCoreSkillCompendiumChoices(root) {
  const input = root.querySelector('[name="axiom.newProtagonistItemCompendium"]');
  if (!(input instanceof HTMLSelectElement)) return;

  const selected = game.settings.get("axiom", "newProtagonistItemCompendium") ?? "";
  const choices = getItemCompendiumChoices();
  input.replaceChildren();

  for (const [value, label] of Object.entries(choices)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value ? label : game.i18n.localize(label);
    option.selected = value === selected;
    input.append(option);
  }
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object") return {};
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (error) {
      // Fall back to Foundry's clone below for environments where structuredClone rejects the value.
    }
  }
  return foundry.utils.deepClone(value);
}

function toItemSource(document) {
  const source = document?.toObject instanceof Function
    ? document.toObject()
    : clonePlainObject(document ?? {});

  const itemData = {
    name: source.name,
    type: source.type,
    img: source.img,
    system: clonePlainObject(source.system ?? {}),
    effects: clonePlainObject(source.effects ?? [])
  };

  if (!itemData.img) delete itemData.img;
  if (!itemData.effects.length) delete itemData.effects;

  return itemData;
}


function renderActorSheets(actor) {
  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.document?.documentName !== "Actor") continue;
    if (app.document.id !== actor.id && app.document.uuid !== actor.uuid) continue;
    app.render(false);
  }

  actor?.sheet?.render?.(false);
}

async function preloadConfiguredItems(actor) {
  if (!game.user?.isGM || !["protagonist", "npc"].includes(actor?.type)) return;

  const packKey = game.settings.get("axiom", "newProtagonistItemCompendium");
  if (!packKey) return;

  const pack = game.packs?.get(packKey);
  if (!pack) {
    ui.notifications?.warn(game.i18n.format("AXIOM.Settings.NewProtagonistItemCompendium.MissingPack", { pack: packKey }));
    return;
  }

  let documents = [];
  try {
    documents = await pack.getDocuments();
  } catch (error) {
    console.error(`AXIOM//CORE | Failed to load configured item compendium: ${packKey}`, error);
    ui.notifications?.error(game.i18n.format("AXIOM.Settings.NewProtagonistItemCompendium.LoadError", { pack: pack.metadata?.label ?? packKey }));
    return;
  }

  const existing = new Set(actor.items.map(item => `${item.type}:${item.name}`));
  const items = documents
    .filter(document => document?.documentName === "Item" && document?.type === "skill")
    .filter(document => !existing.has(`${document.type}:${document.name}`))
    .map(toItemSource);

  if (!items.length) return;

  try {
    await actor.createEmbeddedDocuments("Item", items);
    renderActorSheets(actor);
  } catch (error) {
    console.error(`AXIOM//CORE | Failed to preload items on new Actor: ${actor.name}`, error);
    ui.notifications?.error(game.i18n.format("AXIOM.Settings.NewProtagonistItemCompendium.LoadError", { pack: pack.metadata?.label ?? packKey }));
  }
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

  game.settings.register("axiom", "newProtagonistItemCompendium", {
    name: "AXIOM.Settings.NewProtagonistItemCompendium.Name",
    hint: "AXIOM.Settings.NewProtagonistItemCompendium.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: getItemCompendiumChoices(),
    default: ""
  });

  game.settings.register("axiom", "unarmedCombatSkillName", {
    name: "AXIOM.Settings.UnarmedCombatSkillName.Name",
    hint: "AXIOM.Settings.UnarmedCombatSkillName.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "Melee"
  });

  game.settings.register("axiom", "woundScale", {
    name: "AXIOM.Settings.WoundScale.Name",
    hint: "AXIOM.Settings.WoundScale.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      standard: "AXIOM.Settings.WoundScale.Standard",
      expanded: "AXIOM.Settings.WoundScale.Expanded"
    },
    default: "standard",
    onChange: renderOpenSheets
  });

  Hooks.once("setup", refreshNewActorCoreSkillCompendiumChoices);
  Hooks.once("ready", refreshNewActorCoreSkillCompendiumChoices);

  Hooks.on("renderSettingsConfig", (app, html) => {
    refreshNewActorCoreSkillCompendiumChoices();
    const root = getSettingsConfigElement(html, app);
    if (root) {
      updateStandardCurrencySettingVisibility(root);
      updateNewActorCoreSkillCompendiumChoices(root);
    }
  });

  Hooks.on("createActor", actor => {
    preloadConfiguredItems(actor);
  });
}
