const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { mergeObject } = foundry.utils;
import AxiomRollWindow from "../../apps/roll-window.mjs";
import AxiomEffectBuilder from "../../apps/effect-builder.mjs";
import { formatAxiomPrice, getStoredCurrencyCoins, prepareCurrencyContext, priceCoinsToValue } from "../../system/currency.mjs";
import { getWeaponCategory, handStateUsesMainHand, handStateUsesOffHand, isEquippedGearState, isHandEquippableItem, isHandGearState, isMeleeWeaponItem, isRangedWeaponItem, isWeaponItem, isShieldItem, WEAPON_ITEM_TYPES, SHIELD_ITEM_TYPE } from "../../system/items.mjs";

const LEGACY_ACTIVE_EFFECT_MODE_TYPES = Object.freeze({
  0: "custom",
  1: "multiply",
  2: "add",
  3: "downgrade",
  4: "upgrade",
  5: "override",
  custom: "custom",
  multiply: "multiply",
  add: "add",
  subtract: "subtract",
  downgrade: "downgrade",
  upgrade: "upgrade",
  override: "override"
});

const ACTIVE_EFFECT_TYPE_PRIORITIES = Object.freeze({
  custom: 0,
  multiply: 10,
  add: 20,
  subtract: 20,
  downgrade: 30,
  upgrade: 40,
  override: 50
});

function normalizeActiveEffectChangeType(value) {
  const key = String(value ?? "add").toLowerCase();
  return LEGACY_ACTIVE_EFFECT_MODE_TYPES[key] ?? "add";
}

function cloneActiveEffectChange(change) {
  return typeof change?.toObject === "function" ? change.toObject() : foundry.utils.deepClone(change ?? {});
}

async function migrateActiveEffectChangeTypes(effect) {
  const changes = Array.from(effect?.changes ?? []);
  if (!changes.length) return false;

  let changed = false;
  const normalized = changes.map(change => {
    const data = cloneActiveEffectChange(change);
    const legacyMode = data.mode;
    const type = normalizeActiveEffectChangeType(data.type ?? legacyMode);

    if (data.type !== type) {
      data.type = type;
      changed = true;
    }

    if ("mode" in data) {
      delete data.mode;
      changed = true;
    }

    if (!Number.isFinite(Number(data.priority))) {
      data.priority = ACTIVE_EFFECT_TYPE_PRIORITIES[type] ?? 20;
      changed = true;
    }

    return data;
  });

  if (changed) await effect.update({ changes: normalized });
  return changed;
}


function getSystemSchemaField(system, path) {
  let fields = system?.constructor?.schema?.fields ?? system?.schema?.fields ?? system?.schema;
  const parts = String(path ?? "").split(".");

  for (const [index, part] of parts.entries()) {
    if (!fields) return null;

    const field = fields[part];
    if (!field) return null;
    if (index === parts.length - 1) return field;

    fields = field.fields
      ?? field.model?.schema?.fields
      ?? field.modelClass?.schema?.fields
      ?? field.model?.defineSchema?.()
      ?? field.modelClass?.defineSchema?.()
      ?? field.element?.fields
      ?? null;
  }

  return null;
}

async function enrichHTML(value, relativeTo) {
  const content = String(value ?? "");
  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (!editor?.enrichHTML) return content;

  return editor.enrichHTML(content, {
    async: true,
    secrets: relativeTo?.isOwner ?? false,
    relativeTo,
    rollData: relativeTo?.getRollData?.()
  });
}

const COMBAT_GEAR_ITEM_TYPES = ["equipment", "armor", "ammunition", SHIELD_ITEM_TYPE, ...WEAPON_ITEM_TYPES];

function normalizeWeaponReloadMethod(value) {
  const method = String(value ?? "").trim();
  if (["none", "thrown", "drawn", "single"].includes(method)) return method;
  if (method === "free") return "drawn";
  if (["magazine", "speedloader", "breakAction", "beltFed", "internalMagazine", "revolverCylinder", "muzzle"].includes(method)) return "single";
  return "none";
}

const ATTRIBUTE_ORDER = [
  "strength",
  "agility",
  "fortitude",
  "logic",
  "resolve",
  "charisma",
  "instinct",
  "power"
];

export default class AxiomActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "actor"],
    position: {
      width: 760,
      height: 900
    },
    window: {
      resizable: true
    },
    form: {
      handler: AxiomActorSheet._onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    }
  }, { inplace: false });

  static PARTS = {
    form: {
      template: "systems/axiom/templates/sheets/actor/protagonist-sheet.hbs"
    }
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "main", icon: "fa-solid fa-table-cells-large", label: "AXIOM.Actor.Tabs.Main" },
        { id: "skills", icon: "fa-solid fa-dice-d20", label: "AXIOM.Actor.Tabs.Skills" },
        { id: "combat", icon: "fa-solid fa-shield-halved", label: "AXIOM.Actor.Tabs.Combat" },
        { id: "equipment", icon: "fa-solid fa-backpack", label: "AXIOM.Actor.Tabs.Equipment" },
        { id: "effects", icon: "fa-solid fa-bolt", label: "AXIOM.Actor.Tabs.Effects" },
        { id: "details", icon: "fa-solid fa-pen-to-square", label: "AXIOM.Actor.Tabs.Details" }
      ],
      initial: "main"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.actor = this.actor;
    context.document = this.actor;
    context.source = this.actor.toObject();
    context.system = this.actor.system;
    context.fields = this.actor.system?.constructor?.schema?.fields ?? this.actor.system?.schema?.fields ?? {};
    context.enriched = await this._prepareEnrichedContent();
    context.editorFields = this._prepareEditorFields();
    this._enrichedItemDescriptions = await this._prepareEnrichedItemDescriptions();
    context.config = CONFIG.AXIOM ?? {};

    const activeTab = this._getActiveTab();
    context.activeTab = activeTab;
    context.tabs = this._getPreparedTabs(activeTab);
    context.tabClasses = Object.fromEntries(
      this.constructor.TABS.sheet.tabs.map(tab => [tab.id, tab.id === activeTab ? "active" : ""])
    );

    context.mock = this._prepareMockData();
    context.mainTab = this._prepareMainTabData();
    context.skillTab = this._prepareSkillTabData();
    context.combatTab = this._prepareCombatTabData();
    context.currency = prepareCurrencyContext();
    context.equipmentTab = this._prepareEquipmentTabData();
    context.detailsTab = this._prepareDetailsTabData();
    context.effectTab = this._prepareEffectTabData();
    return context;
  }

  _prepareEditorFields() {
    return {
      details: {
        biography: getSystemSchemaField(this.actor.system, "details.biography"),
        notes: getSystemSchemaField(this.actor.system, "details.notes")
      }
    };
  }

  async _prepareEnrichedContent() {
    return {
      system: {
        details: {
          biography: await enrichHTML(this.actor.system.details?.biography, this.actor),
          notes: await enrichHTML(this.actor.system.details?.notes, this.actor)
        }
      }
    };
  }

  _getActiveTab() {
    return this.tabGroups?.sheet ?? this.constructor.TABS.sheet.initial ?? "main";
  }

  _getPreparedTabs(activeTab = this._getActiveTab()) {
    return this.constructor.TABS.sheet.tabs.map(tab => ({
      ...tab,
      active: tab.id === activeTab,
      cssClass: tab.id === activeTab ? "active" : ""
    }));
  }

  _getAttributeValue(key) {
    return Number(this.actor.system.attributes?.[key]?.value ?? 0);
  }

  _getAttributeLabel(key) {
    return CONFIG.AXIOM?.attributes?.[key] ?? key;
  }

  _prepareMainTabData() {
    const traits = this.actor.items
      .filter(item => item.type === "trait")
      .map(item => this._prepareTraitRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      qualities: traits.filter(trait => trait.category === "quality"),
      flaws: traits.filter(trait => trait.category === "flaw")
    };
  }

  _prepareTraitRow(item) {
    const category = item.system?.category ?? "quality";

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      category,
      description: this._prepareItemDescription(item),
      categoryLabel: this._localizeConfigLabel(CONFIG.AXIOM?.traitCategories?.[category], category)
    };
  }


  _prepareAttributeCheckPresets() {
    const presets = CONFIG.AXIOM?.attributeCheckPresets ?? {};

    return Object.entries(presets).map(([key, preset]) => ({
      key,
      label: preset.label,
      attributeOne: preset.attributeOne,
      attributeTwo: preset.attributeTwo,
      attributeOneLabel: this._getAttributeLabel(preset.attributeOne),
      attributeTwoLabel: this._getAttributeLabel(preset.attributeTwo),
      attributesLabel: `${game.i18n.localize(this._getAttributeLabel(preset.attributeOne))} + ${game.i18n.localize(this._getAttributeLabel(preset.attributeTwo))}`
    }));
  }

  _prepareSkillTabData() {
    const skills = this.actor.items
      .filter(item => item.type === "skill")
      .map(item => this._prepareSkillRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      core: skills.filter(skill => skill.category === "core"),
      expertise: skills.filter(skill => skill.category === "expertise"),
      attributeCheck: this._prepareAttributeCheckRow({
        id: "custom",
        attributeOne: "strength",
        attributeTwo: "agility"
      }),
      attributeCheckPresets: this._prepareAttributeCheckPresets()
    };
  }

  _getSkillEffectKey(item) {
    return item?.id ? `flags.axiom.skillModifiers.${item.id}` : null;
  }

  _getSkillNameEffectKey(item) {
    const normalizedName = this._normalizeSkillReference(item?.name);
    return normalizedName ? `flags.axiom.skillNameModifiers.${normalizedName}` : null;
  }

  _getSkillAdjustedValue(item) {
    let value = Number(item?.system?.level ?? 0);
    const keys = [this._getSkillEffectKey(item), this._getSkillNameEffectKey(item)].filter(Boolean);
    if (!keys.length) return value;

    for (const { effect } of this._getApplicableEffects()) {
      if (effect.disabled || effect.getFlag?.("axiom", "conditional")) continue;
      if (foundry.utils.getProperty(effect, "flags.axiom.status")) continue;

      for (const change of effect.changes ?? []) {
        if (!keys.includes(change.key)) continue;
        const changeValue = Number(change.value ?? 0);
        if (!Number.isFinite(changeValue)) continue;

        switch (normalizeActiveEffectChangeType(change.type ?? change.mode)) {
          case "add":
            value += changeValue;
            break;
          case "subtract":
            value -= changeValue;
            break;
          case "multiply":
            value *= changeValue;
            break;
          case "override":
            value = changeValue;
            break;
          case "upgrade":
            value = Math.max(value, changeValue);
            break;
          case "downgrade":
            value = Math.min(value, changeValue);
            break;
        }
      }
    }

    return value;
  }

  _prepareSkillRow(item) {
    const system = item.system ?? {};
    const attributeOne = system.attributeOne ?? "strength";
    const attributeTwo = system.attributeTwo ?? attributeOne;
    const level = Number(system.level ?? 0);
    const adjustedLevel = this._getSkillAdjustedValue(item);
    const attributeOneValue = this._getAttributeValue(attributeOne);
    const attributeTwoValue = this._getAttributeValue(attributeTwo);

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      category: system.category ?? "core",
      level: adjustedLevel,
      baseLevel: level,
      attributeOne,
      attributeTwo,
      attributeOneLabel: this._getAttributeLabel(attributeOne),
      attributeTwoLabel: this._getAttributeLabel(attributeTwo),
      attributesLabel: `${game.i18n.localize(this._getAttributeLabel(attributeOne))} + ${game.i18n.localize(this._getAttributeLabel(attributeTwo))}`,
      description: this._prepareItemDescription(item),
      total: attributeOneValue + attributeTwoValue + adjustedLevel
    };
  }

  _prepareAttributeOptions(selectedKey) {
    return ATTRIBUTE_ORDER.map(key => ({
      key,
      label: this._getAttributeLabel(key),
      value: this._getAttributeValue(key),
      selected: key === selectedKey
    }));
  }

  _prepareAttributeCheckRow(check) {
    const attributeOneValue = this._getAttributeValue(check.attributeOne);
    const attributeTwoValue = this._getAttributeValue(check.attributeTwo);

    return {
      ...check,
      attributeOneLabel: this._getAttributeLabel(check.attributeOne),
      attributeTwoLabel: this._getAttributeLabel(check.attributeTwo),
      total: attributeOneValue + attributeTwoValue + 30,
      attributeOneOptions: this._prepareAttributeOptions(check.attributeOne),
      attributeTwoOptions: this._prepareAttributeOptions(check.attributeTwo)
    };
  }



  _prepareEquipmentTabData() {
    const equipment = this.actor.items
      .filter(item => item.type === "equipment")
      .map(item => this._prepareEquipmentRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      summary: this._prepareEquipmentSummary(),
      equipment
    };
  }

  _prepareEquipmentSummary() {
    const weightItems = this.actor.items.filter(item => COMBAT_GEAR_ITEM_TYPES.includes(item.type));
    const carriedItems = weightItems.filter(item => {
      const state = item.system?.state ?? "carried";
      return state === "carried" || isEquippedGearState(state);
    });
    const equippedItems = weightItems.filter(item => isEquippedGearState(item.system?.state ?? "carried"));
    const storedItems = weightItems.filter(item => (item.system?.state ?? "carried") === "stored");

    const totalWeight = carriedItems.reduce((sum, item) => {
      const weight = Number(item.system?.weight ?? 0);
      const quantity = Number(item.system?.quantity ?? 1);
      return sum + (weight * quantity);
    }, 0);

    return {
      totalWeight: this._formatWeight(totalWeight),
      carriedCount: carriedItems.length,
      equippedCount: equippedItems.length,
      storedCount: storedItems.length,
      currency: this.actor.system.currency?.value ?? "",
      currencyCoins: getStoredCurrencyCoins(this.actor.system.currency ?? {})
    };
  }

  _prepareEquipmentRow(item) {
    const system = item.system ?? {};
    const quantity = Number(system.quantity ?? 1);
    const weight = Number(system.weight ?? 0);
    const totalWeight = weight * quantity;

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      description: this._prepareItemDescription(item),
      quantity,
      weight: this._formatWeight(weight),
      totalWeight: this._formatWeight(totalWeight),
      price: formatAxiomPrice(system),
      availability: Number(system.availability ?? 0),
      skill: system.skill ?? "",
      rollModifier: Number(system.rollModifier ?? 0),
      canRoll: Boolean(system.skill),
      state: system.state ?? "carried",
      stateLabel: this._localizeGearState(system.state),
      stateOptions: this._prepareGearStateOptions(system.state, item)
    };
  }

  _formatWeight(value) {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return "0";
    if (Number.isInteger(number)) return String(number);
    return number.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }


  _prepareCombatTabData() {
    const weapons = this.actor.items
      .filter(item => isWeaponItem(item))
      .map(item => this._prepareWeaponCombatRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    const shields = this.actor.items
      .filter(item => isShieldItem(item))
      .map(item => this._prepareShieldCombatRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    const armor = this.actor.items
      .filter(item => item.type === "armor")
      .map(item => this._prepareArmorCombatRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    const ammunition = this.actor.items
      .filter(item => item.type === "ammunition")
      .map(item => this._prepareAmmunitionCombatRow(item))
      .sort((a, b) => a.name.localeCompare(b.name));

    const meleeWeapons = weapons.filter(weapon => weapon.category === "melee");
    const rangedWeapons = weapons.filter(weapon => weapon.category === "ranged");
    const mixedWeapons = weapons.filter(weapon => weapon.category === "mixed");
    const meleeItems = [...meleeWeapons, ...shields].sort((a, b) => a.name.localeCompare(b.name));

    return {
      armorSummary: this._prepareEquippedArmorSummary(),
      weapons,
      meleeWeapons,
      shields,
      meleeItems,
      rangedWeapons,
      mixedWeapons,
      hasWeaponsOrShields: Boolean(meleeItems.length || rangedWeapons.length || mixedWeapons.length),
      ammunition,
      armor
    };
  }

  _prepareEquippedArmorSummary() {
    const totals = { head: 0, torso: 0, arms: 0, legs: 0 };

    for (const item of this.actor.items.filter(item => item.type === "armor" && item.system?.state === "equipped")) {
      totals.head += Number(item.system.armor?.head ?? 0);
      totals.torso += Number(item.system.armor?.torso ?? 0);
      totals.arms += Number(item.system.armor?.arms ?? 0);
      totals.legs += Number(item.system.armor?.legs ?? 0);
    }

    return totals;
  }

  _prepareWeaponCombatRow(item) {
    const system = item.system ?? {};
    const category = getWeaponCategory(item);
    const range = Number(system.range ?? 0);
    const ammoContainer = Number(system.ammoContainer ?? 0);
    const ammoLoaded = Math.max(0, Number(system.ammo ?? 0));
    const loadingMethod = normalizeWeaponReloadMethod(system.reloadMethod);
    const linkedAmmunition = this.actor.items.get(String(system.ammunition ?? ""));
    const linkedAmmunitionQuantity = linkedAmmunition?.type === "ammunition" ? Math.max(0, Number(linkedAmmunition.system?.quantity ?? 0)) : null;
    const weaponQuantity = Math.max(0, Number(system.quantity ?? 0));
    const versatileDamageBonus = this._getVersatileDamageBonus(system);
    const baseDamage = Number(system.damage ?? 0);
    let ammoDisplay = "";
    if (loadingMethod === "single") ammoDisplay = `${ammoLoaded}/${ammoContainer}`;
    else if (loadingMethod === "drawn") ammoDisplay = linkedAmmunition ? `${linkedAmmunition.name} ${linkedAmmunitionQuantity}` : game.i18n.localize("AXIOM.Weapon.NoAmmunition");
    else if (loadingMethod === "thrown") ammoDisplay = game.i18n.format("AXIOM.Weapon.QuantityDisplay", { quantity: weaponQuantity });

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      category,
      description: this._prepareItemDescription(item),
      categoryLabel: this._localizeConfigLabel(CONFIG.AXIOM?.weaponCategories?.[category], category),
      isMelee: category === "melee",
      isRanged: category === "ranged",
      isMixed: category === "mixed",
      damage: baseDamage,
      effectiveDamage: baseDamage + versatileDamageBonus,
      versatileDamageBonus,
      armorPenetration: Number(system.armorPenetration ?? 0),
      delivery: this._localizeConfigLabel(CONFIG.AXIOM?.damageDelivery?.[system.delivery], system.delivery ?? "kinetic"),
      elemental: this._localizeConfigLabel(CONFIG.AXIOM?.elementalDamage?.[system.elemental || "none"], system.elemental || ""),
      skill: system.skill ?? "",
      meleeSkill: system.meleeSkill || system.skill || "Melee",
      rangedSkill: system.rangedSkill || system.skill || (category === "mixed" ? "Athletics" : "Marksmanship"),
      reach: Number(system.reach ?? 0),
      parryBonus: Number(system.parryBonus ?? 0),
      range,
      ammoLoaded,
      ammoContainer,
      ammoDisplay,
      loadingMethod,
      linkedAmmunitionName: linkedAmmunition?.name ?? "",
      linkedAmmunitionQuantity,
      showAmmoDisplay: Boolean(ammoDisplay),
      canReload: (category === "ranged" || category === "mixed") && loadingMethod === "single" && ammoContainer > 0,
      state: system.state ?? "carried",
      stateLabel: this._localizeGearState(system.state),
      stateOptions: this._prepareGearStateOptions(system.state, item),
      hands: system.hands ?? "one",
      handsLabel: this._localizeConfigLabel(CONFIG.AXIOM?.weaponHands?.[system.hands ?? "one"], system.hands ?? "one"),
      minStrength: Number(system.minStrength ?? 0),
      meetsMinStrength: this._meetsWeaponStrengthRequirement(system),
      strengthRequirementLabel: this._formatStrengthRequirement(system),
      rangeBands: {
        short: Math.ceil(range / 2),
        medium: range,
        long: range * 2,
        extreme: range * 3
      }
    };
  }

  _getVersatileDamageBonus(system = {}) {
    return system.hands === "versatile" && system.state === "bothHands" ? 1 : 0;
  }


  _prepareShieldCombatRow(item) {
    const system = item.system ?? {};
    const cover = system.cover ?? "light";

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      isShield: true,
      description: this._prepareItemDescription(item),
      skill: system.skill ?? "",
      blockValue: Number(system.blockValue ?? 0),
      armorBonus: Number(system.armorBonus ?? 0),
      cover,
      coverLabel: this._localizeConfigLabel(CONFIG.AXIOM?.coverTypes?.[cover], cover),
      state: system.state ?? "carried",
      stateLabel: this._localizeGearState(system.state),
      stateOptions: this._prepareGearStateOptions(system.state, item)
    };
  }

  _prepareArmorCombatRow(item) {
    const system = item.system ?? {};
    const armor = system.armor ?? {};

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      description: this._prepareItemDescription(item),
      head: Number(armor.head ?? 0),
      torso: Number(armor.torso ?? 0),
      arms: Number(armor.arms ?? 0),
      legs: Number(armor.legs ?? 0),
      state: system.state ?? "carried",
      stateLabel: this._localizeGearState(system.state),
      stateOptions: this._prepareGearStateOptions(system.state, item)
    };
  }

  _prepareAmmunitionCombatRow(item) {
    const system = item.system ?? {};

    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      description: this._prepareItemDescription(item),
      quantity: Number(system.quantity ?? 0),
      weight: Number(system.weight ?? 0),
      price: formatAxiomPrice(system),
      state: system.state ?? "carried",
      stateLabel: this._localizeGearState(system.state),
      stateOptions: this._prepareGearStateOptions(system.state, item)
    };
  }

  _prepareGearStateOptions(selectedState = "carried", item = null) {
    let states = isHandEquippableItem(item) ? (CONFIG.AXIOM?.handGearStates ?? {}) : (CONFIG.AXIOM?.gearStates ?? {});
    if (isWeaponItem(item) && item.system?.hands === "two") {
      states = Object.fromEntries(Object.entries(states).filter(([key]) => ["bothHands", "carried", "stored"].includes(key)));
    }

    const normalizedState = isWeaponItem(item) && item.system?.hands === "two" && ["equipped", "mainHand", "offHand"].includes(selectedState)
      ? "bothHands"
      : isHandEquippableItem(item) && selectedState === "equipped" ? "mainHand" : (selectedState ?? "carried");

    return Object.entries(states).map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      selected: key === normalizedState
    }));
  }

  _meetsWeaponStrengthRequirement(system = {}) {
    const minimum = Number(system.minStrength ?? 0);
    return minimum <= 0 || this._getAttributeValue("strength") >= minimum;
  }

  _formatStrengthRequirement(system = {}) {
    const minimum = Number(system.minStrength ?? 0);
    if (minimum <= 0) return "";
    return game.i18n.format("AXIOM.Weapon.MinStrengthShort", { value: minimum });
  }

  _localizeConfigLabel(label, fallback = "") {
    if (!label) return fallback;
    return game.i18n.localize(label);
  }

  _localizeGearState(state = "carried") {
    return this._localizeConfigLabel(CONFIG.AXIOM?.gearStates?.[state] ?? CONFIG.AXIOM?.handGearStates?.[state], state);
  }

  async _prepareEnrichedItemDescriptions() {
    const entries = await Promise.all(Array.from(this.actor.items ?? []).map(async item => {
      const raw = String(item.system?.description?.value ?? "").trim();
      if (!raw) return [item.id, ""];
      return [item.id, await enrichHTML(raw, item)];
    }));

    return Object.fromEntries(entries);
  }

  _prepareItemDescription(item) {
    return this._enrichedItemDescriptions?.[item.id] ?? String(item.system?.description?.value ?? "").trim();
  }


  _prepareDetailsTabData() {
    const xp = this.actor.system.details?.xp ?? {};
    const current = Number(xp.current ?? 0);
    const spent = Number(xp.spent ?? 0);

    return {
      xp: {
        current,
        spent,
        total: current + spent
      }
    };
  }


  _getApplicableEffects() {
    const ownedItems = Array.from(this.actor.items ?? []);
    const ownedItemUuids = new Set(ownedItems.map(item => item.uuid).filter(Boolean));
    const effects = [];

    for (const effect of this.actor.effects ?? []) {
      if (this._effectOriginIsOwnedItem(effect, ownedItemUuids)) continue;
      effects.push({
        id: effect.id,
        effect,
        sourceDocument: this.actor,
        source: effect.origin ? this._formatEffectSource(effect.origin) : game.i18n.localize("AXIOM.Actor.Effects.ManualSource")
      });
    }

    for (const item of ownedItems) {
      for (const effect of item.effects ?? []) {
        effects.push({
          id: `${item.id}.${effect.id}`,
          effect,
          sourceDocument: item,
          source: item.name ?? game.i18n.localize("AXIOM.Actor.Effects.ItemSource")
        });
      }
    }

    return effects;
  }

  _effectOriginIsOwnedItem(effect, ownedItemUuids) {
    const origin = String(effect?.origin ?? "");
    if (!origin) return false;
    return Array.from(ownedItemUuids).some(uuid => origin === uuid || origin.startsWith(`${uuid}.`));
  }

  _prepareEffectTabData() {
    const statuses = Object.values(CONFIG.AXIOM?.statuses ?? {})
      .filter(status => !status.hiddenOnSheet)
      .map(status => {
      const value = typeof this.actor.getAxiomStatusValue === "function"
        ? this.actor.getAxiomStatusValue(status.id)
        : Number(this.actor.system.statuses?.[status.id] ?? 0);
      const active = value > 0;

      return {
        ...status,
        value,
        active,
        cssClass: [active ? "active" : "", status.category].filter(Boolean).join(" "),
        title: status.max ? `${game.i18n.localize(status.label)} (${value}/${status.max})` : `${game.i18n.localize(status.label)} (${value})`
      };
    });

    const effects = this._getApplicableEffects()
      .filter(({ effect }) => !foundry.utils.getProperty(effect, "flags.axiom.status"))
      .map(({ id, effect, source }) => ({
      id,
      name: effect.name,
      img: effect.img ?? effect.icon ?? "icons/svg/aura.svg",
      disabled: Boolean(effect.disabled),
      conditional: Boolean(effect.getFlag?.("axiom", "conditional")),
      cssClass: [effect.disabled ? "inactive" : "", effect.getFlag?.("axiom", "conditional") ? "conditional" : ""].filter(Boolean).join(" "),
      source,
      duration: this._formatEffectDuration(effect)
    }));

    return {
      statuses,
      effects,
      activeEffects: effects.filter(effect => !effect.disabled && !effect.conditional),
      conditionalEffects: effects.filter(effect => !effect.disabled && effect.conditional),
      disabledEffects: effects.filter(effect => effect.disabled)
    };
  }

  _formatEffectSource(origin) {
    if (!origin) return game.i18n.localize("AXIOM.Actor.Effects.ManualSource");
    const parts = origin.split(".");
    return parts.at(-2) === "Item" ? game.i18n.localize("AXIOM.Actor.Effects.ItemSource") : game.i18n.localize("AXIOM.Actor.Effects.EffectSource");
  }

  _formatEffectDuration(effect) {
    if (effect.disabled) return game.i18n.localize("AXIOM.Actor.Effects.Inactive");
    const duration = effect.duration ?? {};
    if (duration.label) return duration.label;
    if (duration.rounds) return game.i18n.format("AXIOM.Actor.Effects.Rounds", { rounds: duration.rounds });
    if (duration.seconds) return game.i18n.format("AXIOM.Actor.Effects.Seconds", { seconds: duration.seconds });
    return game.i18n.localize("AXIOM.Actor.Effects.Passive");
  }

  _prepareMockData() {
    const system = this.actor.system;
    const attr = system.attributes ?? {};
    const trackers = system.trackers ?? {};
    const wounds = system.wounds ?? {};

    const readAttribute = (key, label) => {
      const data = attr[key] ?? {};
      const base = Number(data.base ?? 10);
      const adv = Number(data.adv ?? 0);
      const mod = Number(data.mod ?? 0);
      const max = Number(data.max ?? 20);
      const total = Number(data.value ?? (base + adv + mod));
      return { key, label, base, adv, mod, max, total };
    };

    const readTracker = (key, fallback) => {
      const data = trackers[key] ?? fallback;
      const current = Number(data.current ?? fallback.current);
      const min = Number(data.min ?? fallback.min);
      const max = Number(data.max ?? fallback.max);

      return {
        current,
        min,
        max,
        pips: Array.from({ length: Math.max(0, max) }, (_, index) => ({
          index,
          active: index < current
        }))
      };
    };

    const readWoundSlots = (severity) => {
      const track = wounds[severity] ?? {};
      const slots = track.slots ?? {};
      const max = Number(track.max ?? 0);
      const healingMax = Number(track.healingMax ?? 0);
      const keys = ["one", "two", "three", "four", "five"].slice(0, max);

      return keys.map(key => {
        const slot = slots[key] ?? {};
        return {
          key,
          taken: Boolean(slot.taken),
          healing: Number(slot.healing ?? 0),
          healingMax: Number(slot.healingMax ?? healingMax),
          injury: slot.injury ?? ""
        };
      });
    };

    return {
      attributes: [
        readAttribute("strength", "STR"),
        readAttribute("agility", "AGI"),
        readAttribute("fortitude", "FOR"),
        readAttribute("logic", "LOG"),
        readAttribute("resolve", "RES"),
        readAttribute("charisma", "CHA"),
        readAttribute("instinct", "INS"),
        readAttribute("power", "POW")
      ],
      subAttributes: {
        movement: system.subAttributes?.movement ?? 6,
        initiative: system.subAttributes?.initiative ?? 4,
        size: system.size ?? 0,
        damageModifier: system.subAttributes?.damageModifier ?? 0,
        toughness: system.subAttributes?.toughness ?? 4,
        corruption: {
          current: Number(system.corruption?.current ?? 0),
          threshold: Number(system.subAttributes?.corruptionThreshold ?? system.subAttributes?.corruption ?? 6)
        }
      },
      wounds: {
        grazing: readWoundSlots("grazing"),
        minor: readWoundSlots("minor"),
        major: readWoundSlots("major"),
        critical: readWoundSlots("critical"),
        penalties: {
          minor: Number(wounds.penalties?.minor ?? 0),
          major: Number(wounds.penalties?.major ?? 0),
          total: Number(wounds.penalties?.total ?? 0)
        }
      },
      trackers: {
        fate: readTracker("fate", { current: 3, min: 0, max: 3 }),
        actionPoints: readTracker("actionPoints", { current: 3, min: 0, max: 3 }),
        momentum: readTracker("momentum", { current: 0, min: -5, max: 5 })
      },
      qualities: ["Brave", "Loyal", "Resourceful"],
      flaws: ["Stubborn", "Distrustful"],
      equipment: ["Longsword", "Shield", "Chain Mail", "Backpack"]
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element.querySelectorAll("[data-action='toggleNpcConfig']").forEach(element => {
      element.addEventListener("click", this._onToggleNpcConfig.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleWound']").forEach(element => {
      element.addEventListener("click", this._onToggleWound.bind(this));
    });


    this.element.querySelectorAll("[data-action='adjustTracker']").forEach(element => {
      element.addEventListener("click", this._onAdjustTracker.bind(this));
      element.addEventListener("contextmenu", this._onAdjustTracker.bind(this));
    });

    this.element.querySelectorAll("[data-action='updateSkillLevel']").forEach(element => {
      element.addEventListener("change", this._onUpdateSkillLevel.bind(this));
    });

    this.element.querySelectorAll("[data-action='updateAttributeCheckPreview']").forEach(element => {
      element.addEventListener("change", this._onUpdateAttributeCheckPreview.bind(this));
    });

    this.element.querySelectorAll("[data-action='setAttributeCheckPreset']").forEach(element => {
      element.addEventListener("click", this._onSetAttributeCheckPreset.bind(this));
    });

    this.element.querySelectorAll("[data-action='editSkill']").forEach(element => {
      element.addEventListener("click", this._onEditSkill.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteSkill']").forEach(element => {
      element.addEventListener("click", this._onDeleteSkill.bind(this));
    });

    this.element.querySelectorAll("[data-action='rollSkill']").forEach(element => {
      element.addEventListener("click", this._onRollSkill.bind(this));
    });

    this.element.querySelectorAll("[data-action='rollAttributeCheck']").forEach(element => {
      element.addEventListener("click", this._onRollAttributeCheck.bind(this));
    });

    this.element.querySelectorAll("[data-action='editCombatItem']").forEach(element => {
      element.addEventListener("click", this._onEditCombatItem.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteCombatItem']").forEach(element => {
      element.addEventListener("click", this._onDeleteCombatItem.bind(this));
    });

    this.element.querySelectorAll("[data-action='rollWeaponAttack']").forEach(element => {
      element.addEventListener("click", this._onRollWeaponAttack.bind(this));
    });

    this.element.querySelectorAll("[data-action='rollShieldBlock']").forEach(element => {
      element.addEventListener("click", this._onRollShieldBlock.bind(this));
    });

    this.element.querySelectorAll("[data-action='reloadWeapon']").forEach(element => {
      element.addEventListener("click", this._onReloadWeapon.bind(this));
    });

    this.element.querySelectorAll("[data-action='updateCombatItemState']").forEach(element => {
      element.addEventListener("change", this._onUpdateCombatItemState.bind(this));
    });

    this.element.querySelectorAll("[data-action='editEquipmentItem']").forEach(element => {
      element.addEventListener("click", this._onEditEquipmentItem.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteEquipmentItem']").forEach(element => {
      element.addEventListener("click", this._onDeleteEquipmentItem.bind(this));
    });

    this.element.querySelectorAll("[data-action='rollEquipmentItem']").forEach(element => {
      element.addEventListener("click", this._onRollEquipmentItem.bind(this));
    });

    this.element.querySelectorAll("[data-action='updateEquipmentItemState']").forEach(element => {
      element.addEventListener("change", this._onUpdateEquipmentItemState.bind(this));
    });

    this.element.querySelectorAll("[data-action='adjustItemQuantity']").forEach(element => {
      element.addEventListener("click", this._onAdjustItemQuantity.bind(this));
      element.addEventListener("contextmenu", this._onAdjustItemQuantity.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleItemDescription']").forEach(element => {
      element.addEventListener("click", this._onToggleItemDescription.bind(this));
      element.addEventListener("keydown", this._onToggleItemDescriptionKeydown.bind(this));
    });

    this.element.querySelectorAll("[data-action='editTrait']").forEach(element => {
      element.addEventListener("click", this._onEditTrait.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteTrait']").forEach(element => {
      element.addEventListener("click", this._onDeleteTrait.bind(this));
    });

    this.element.querySelectorAll("[data-action='adjustStatus']").forEach(element => {
      element.addEventListener("click", this._onAdjustStatus.bind(this));
    });

    this.element.querySelectorAll("[data-action='createEffect']").forEach(element => {
      element.addEventListener("click", this._onCreateEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleEffect']").forEach(element => {
      element.addEventListener("change", this._onToggleEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='editEffect']").forEach(element => {
      element.addEventListener("click", this._onEditEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteEffect']").forEach(element => {
      element.addEventListener("click", this._onDeleteEffect.bind(this));
    });
  }

  _onToggleNpcConfig(event) {
    event.preventDefault();
    event.stopPropagation();

    const panel = this.element.querySelector("[data-npc-config-panel]");
    if (!panel) return;
    panel.hidden = !panel.hidden;
  }

  _onToggleItemDescriptionKeydown(event) {
    if (!["Enter", " "].includes(event.key)) return;
    this._onToggleItemDescription(event);
  }

  _onToggleItemDescription(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget.closest("[data-item-id], [data-skill-id], [data-trait-id]");
    if (!row) return;

    const description = row.querySelector(".item-description-inline");
    if (!description) return;

    const expanded = row.classList.toggle("expanded");
    description.hidden = !expanded;
    event.currentTarget.setAttribute("aria-expanded", String(expanded));
  }



  async _onAdjustTracker(event) {
    event.preventDefault();
    event.stopPropagation();

    const tracker = event.currentTarget.dataset.tracker;
    if (!tracker || !["fate", "actionPoints"].includes(tracker)) return;

    const data = this.actor.system.trackers?.[tracker];
    if (!data) return;

    const current = Number(data.current ?? 0);
    const min = Number(data.min ?? 0);
    const max = Number(data.max ?? 0);
    const direction = event.type === "contextmenu" ? 1 : -1;
    const next = Math.min(max, Math.max(min, current + direction));

    if (next === current) return;
    await this.actor.update({ [`system.trackers.${tracker}.current`]: next });
  }

  async _onToggleWound(event) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const severity = target.dataset.woundSeverity;
    const key = target.dataset.woundKey;

    if (!severity || !key) return;

    const path = `system.wounds.${severity}.slots.${key}.taken`;
    const current = foundry.utils.getProperty(this.actor, path);

    await this.actor.update({ [path]: !current });
  }


  async _onAdjustStatus(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const cell = button.closest("[data-status-id]");
    const statusId = cell?.dataset.statusId;
    const direction = Number(button.dataset.direction ?? 0);
    const status = CONFIG.AXIOM?.statuses?.[statusId];

    if (!statusId || !direction || !status) return;

    if (direction > 0) {
      await this.actor.addStatus?.(statusId, 1);
    } else {
      await this.actor.removeStatus?.(statusId, 1);
    }
  }

  async _onCreateEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const effect = await AxiomEffectBuilder.prompt(this.actor);
    if (!effect) return;
    await migrateActiveEffectChangeTypes(effect);
    effect.sheet?.render(true);
  }

  async _onToggleEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const effect = this._getEffectFromEvent(event);
    if (!effect) return;
    await effect.update({ disabled: !event.currentTarget.checked });
  }

  _getEffectFromEvent(event) {
    const effectId = event.currentTarget.closest("[data-effect-id]")?.dataset.effectId;
    if (!effectId) return null;

    if (effectId.includes(".")) {
      const [itemId, itemEffectId] = effectId.split(".");
      return this.actor.items.get(itemId)?.effects.get(itemEffectId) ?? null;
    }

    return this.actor.effects.get(effectId) ?? null;
  }

  async _onEditEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const effect = this._getEffectFromEvent(event);
    if (!effect) return;
    await migrateActiveEffectChangeTypes(effect);
    effect.sheet?.render(true);
  }

  async _onDeleteEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const effect = this._getEffectFromEvent(event);
    if (!effect) return;
    await effect.delete();
  }


  _getTraitItemFromEvent(event) {
    const itemId = event.currentTarget.closest("[data-trait-id]")?.dataset.traitId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  _onEditTrait(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getTraitItemFromEvent(event);
    if (!item) return;

    item.sheet?.render(true);
  }

  async _onDeleteTrait(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getTraitItemFromEvent(event);
    if (!item) return;

    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  _getEquipmentItemFromEvent(event) {
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  _onEditEquipmentItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getEquipmentItemFromEvent(event);
    if (!item) return;

    item.sheet?.render(true);
  }

  async _onDeleteEquipmentItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getEquipmentItemFromEvent(event);
    if (!item) return;

    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  async _onUpdateEquipmentItemState(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getEquipmentItemFromEvent(event);
    if (!item) return;

    await this._updateItemState(item, event.currentTarget.value);
  }

  async _onAdjustItemQuantity(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getItemFromQuantityEvent(event);
    if (!item || !["equipment", "ammunition"].includes(item.type)) return;

    const current = Number(item.system?.quantity ?? 0);
    const step = this._getQuantityAdjustmentStep(event);
    const direction = event.type === "contextmenu" ? 1 : -1;
    const next = Math.max(0, current + (direction * step));

    if (next === current) return;
    await item.update({ "system.quantity": next });
  }

  _getItemFromQuantityEvent(event) {
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  _getQuantityAdjustmentStep(event) {
    if (event.shiftKey && (event.ctrlKey || event.metaKey)) return 10;
    if (event.shiftKey) return 5;
    return 1;
  }


  _onRollEquipmentItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getEquipmentItemFromEvent(event);
    if (!item) return;

    const skillReference = item.system?.skill;
    const skill = this._resolveActorSkill(skillReference);

    if (!skill) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Equipment.NoSkillSelectedWarning"));
      item.sheet?.render(true);
      return;
    }

    const rollModifier = Number(item.system?.rollModifier ?? 0);

    new AxiomRollWindow({
      rollData: {
        actor: this.actor,
        item,
        skillItem: skill,
        title: `${item.name}: ${skill.name}`,
        testName: `${item.name}: ${skill.name}`,
        testType: "skill",
        attributeOne: skill.system.attributeOne ?? "strength",
        attributeTwo: skill.system.attributeTwo ?? skill.system.attributeOne ?? "strength",
        skillValue: Number(skill.system.level ?? 0),
        equipmentModifier: rollModifier
      }
    }).render({ force: true });
  }


  _normalizeSkillReference(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase(game.i18n.lang)
      .replaceAll(/[^\p{L}\p{N}]+/gu, "");
  }

  _getSkillAliases(skill) {
    const aliases = new Set([skill.id, skill.name]);
    const name = this._normalizeSkillReference(skill.name);

    const standardAliases = {
      melee: ["melee", game.i18n.localize("AXIOM.Skill.Names.Melee")],
      marksmanship: ["marksmanship", game.i18n.localize("AXIOM.Skill.Names.Marksmanship")],
      athletics: ["athletics", game.i18n.localize("AXIOM.Skill.Names.Athletics")]
    };

    for (const [key, values] of Object.entries(standardAliases)) {
      if (values.map(value => this._normalizeSkillReference(value)).includes(name)) {
        aliases.add(key);
        values.forEach(value => aliases.add(value));
      }
    }

    return Array.from(aliases).map(value => this._normalizeSkillReference(value));
  }

  _resolveActorSkill(reference) {
    const raw = String(reference ?? "").trim();
    if (!raw) return null;

    const direct = this.actor.items.get(raw);
    if (direct?.type === "skill") return direct;

    const normalized = this._normalizeSkillReference(raw);
    return this.actor.items
      .filter(item => item.type === "skill")
      .find(skill => this._getSkillAliases(skill).includes(normalized)) ?? null;
  }

  _getCombatItemFromEvent(event) {
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  _onEditCombatItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getCombatItemFromEvent(event);
    if (!item) return;

    item.sheet?.render(true);
  }

  async _onDeleteCombatItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getCombatItemFromEvent(event);
    if (!item) return;

    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  async _onUpdateCombatItemState(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getCombatItemFromEvent(event);
    if (!item) return;

    await this._updateItemState(item, event.currentTarget.value);
  }

  async _updateItemState(item, state) {
    if (!item) return;

    if (isWeaponItem(item) && item.system?.hands === "two" && isHandGearState(state)) {
      state = "bothHands";
    }

    if (isHandEquippableItem(item) && isHandGearState(state)) {
      const usesMain = handStateUsesMainHand(state);
      const usesOff = handStateUsesOffHand(state);
      const conflicts = this.actor.items
        .filter(other => other.id !== item.id && isHandEquippableItem(other))
        .filter(other => {
          const otherState = other.system?.state;
          return (usesMain && handStateUsesMainHand(otherState)) || (usesOff && handStateUsesOffHand(otherState));
        })
        .map(other => ({ _id: other.id, "system.state": "carried" }));

      if (conflicts.length) await this.actor.updateEmbeddedDocuments("Item", conflicts);
    }

    await item.update({ "system.state": state });
  }

  async _onReloadWeapon(event) {
    event.preventDefault();
    event.stopPropagation();

    const weapon = this._getCombatItemFromEvent(event);
    if (!weapon || !isRangedWeaponItem(weapon)) return;

    const loadingMethod = normalizeWeaponReloadMethod(weapon.system?.reloadMethod);
    if (loadingMethod !== "single") return;

    const ammoContainer = Number(weapon.system?.ammoContainer ?? 0);
    const ammoLoaded = Math.max(0, Number(weapon.system?.ammo ?? 0));
    if (ammoContainer <= 0) return;

    const missing = Math.max(0, ammoContainer - ammoLoaded);
    if (missing <= 0) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.ReloadContainerFull", { weapon: weapon.name }));
      return;
    }

    const ammunitionId = String(weapon.system?.ammunition ?? "").trim();
    if (!ammunitionId) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.ReloadNoAmmunitionSelected", { weapon: weapon.name }));
      return;
    }

    const ammunition = this.actor.items.get(ammunitionId);
    if (!ammunition || ammunition.type !== "ammunition") {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.ReloadAmmunitionMissing", { weapon: weapon.name }));
      return;
    }

    const available = Math.max(0, Number(ammunition.system?.quantity ?? 0));
    if (available <= 0) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.ReloadNoAmmunitionAvailable", { ammunition: ammunition.name }));
      return;
    }

    const amount = 1;
    await weapon.update({ "system.ammo": ammoLoaded + amount });
    await ammunition.update({ "system.quantity": available - amount });

    ui.notifications?.info(game.i18n.format("AXIOM.Weapon.Reloaded", {
      weapon: weapon.name,
      ammunition: ammunition.name,
      amount
    }));
  }

  _onRollWeaponAttack(event) {
    event.preventDefault();
    event.stopPropagation();

    const weapon = this._getCombatItemFromEvent(event);
    if (!weapon) return;

    const minimumStrength = Number(weapon.system?.minStrength ?? 0);
    if (minimumStrength > 0 && this._getAttributeValue("strength") < minimumStrength) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.MinStrengthWarning", {
        weapon: weapon.name,
        value: minimumStrength
      }));
      return;
    }

    const requestedMode = event.currentTarget?.dataset?.weaponMode;
    const category = getWeaponCategory(weapon);
    const weaponMode = requestedMode || (category === "ranged" ? "ranged" : "melee");
    const skillName = weaponMode === "ranged"
      ? (weapon.system?.rangedSkill || weapon.system?.skill)
      : (weapon.system?.meleeSkill || weapon.system?.skill);

    const skill = this._resolveActorSkill(skillName);
    if (!skill) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Weapon.NoSkillSelectedWarning", {
        weapon: weapon.name,
        skill: skillName || game.i18n.localize("AXIOM.Weapon.NoSkill")
      }));
      weapon.sheet?.render(true);
      return;
    }

    new AxiomRollWindow({
      rollData: {
        actor: this.actor,
        item: weapon,
        skillItem: skill,
        title: `${weapon.name}: ${skill.name}`,
        testName: `${weapon.name}: ${skill.name}`,
        testType: "weapon",
        sourceType: "item",
        weaponMode,
        attributeOne: skill.system.attributeOne ?? "strength",
        attributeTwo: skill.system.attributeTwo ?? skill.system.attributeOne ?? "strength",
        skillValue: Number(skill.system.level ?? 0)
      }
    }).render({ force: true });
  }



  _onRollShieldBlock(event) {
    event.preventDefault();
    event.stopPropagation();

    const shield = this._getCombatItemFromEvent(event);
    if (!shield || shield.type !== SHIELD_ITEM_TYPE) return;

    const skill = this._resolveActorSkill(shield.system?.skill);
    if (!skill) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Shield.NoSkillSelectedWarning", {
        shield: shield.name,
        skill: shield.system?.skill || game.i18n.localize("AXIOM.Weapon.NoSkill")
      }));
      shield.sheet?.render(true);
      return;
    }

    new AxiomRollWindow({
      rollData: {
        actor: this.actor,
        item: shield,
        skillItem: skill,
        title: game.i18n.format("AXIOM.Combat.BlockWith", { shield: shield.name }),
        testName: game.i18n.format("AXIOM.Combat.BlockWith", { shield: shield.name }),
        testType: "defense",
        sourceType: "shield",
        attributeOne: skill.system.attributeOne ?? "strength",
        attributeTwo: skill.system.attributeTwo ?? skill.system.attributeOne ?? "strength",
        skillValue: Number(skill.system.level ?? 0),
        equipmentModifier: Number(shield.system?.blockValue ?? 0),
        actionPoints: 0
      }
    }).render({ force: true });
  }

  _getSkillItemFromEvent(event) {
    const itemId = event.currentTarget.closest("[data-skill-id]")?.dataset.skillId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  _onEditSkill(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getSkillItemFromEvent(event);
    if (!item) return;

    item.sheet?.render(true);
  }

  async _onDeleteSkill(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getSkillItemFromEvent(event);
    if (!item) return;

    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
  }

  _updateAttributeCheckPreview(row) {
    if (!row) return;

    const selects = row.querySelectorAll("select[data-action='updateAttributeCheckPreview']");
    const total = Array.from(selects).reduce((sum, select) => {
      const selected = select.selectedOptions?.[0];
      return sum + Number(selected?.dataset.value ?? 0);
    }, 30);

    const totalElement = row.querySelector("[data-attribute-check-total]");
    if (totalElement) totalElement.textContent = String(total);
  }

  _onUpdateAttributeCheckPreview(event) {
    const row = event.currentTarget.closest("[data-check-id]");
    if (!row) return;

    row.dataset.checkName = "";
    this._updateAttributeCheckPreview(row);
  }

  _onSetAttributeCheckPreset(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    this._rollAttributeCheck({
      checkId: button.dataset.preset || this._getAttributeCheckPresetId(button),
      checkName: button.dataset.checkName || game.i18n.localize("AXIOM.Actor.Skills.AttributeCheck"),
      attributeOne: button.dataset.attributeOne ?? "strength",
      attributeTwo: button.dataset.attributeTwo ?? button.dataset.attributeOne ?? "strength"
    });
  }

  _getAttributeCheckPresetId(button) {
    const attributeOne = button?.dataset?.attributeOne;
    const attributeTwo = button?.dataset?.attributeTwo;
    const label = button?.dataset?.checkName;

    return Object.entries(CONFIG.AXIOM?.attributeCheckPresets ?? {}).find(([, preset]) => {
      const presetLabel = game.i18n.localize(preset.label);
      return preset.attributeOne === attributeOne && preset.attributeTwo === attributeTwo && (!label || presetLabel === label);
    })?.[0] ?? "custom";
  }

  _rollAttributeCheck({ checkId = "custom", checkName = "", attributeOne = "strength", attributeTwo = attributeOne } = {}) {
    const title = checkName || game.i18n.localize("AXIOM.Actor.Skills.AttributeCheck");

    new AxiomRollWindow({
      rollData: {
        actor: this.actor,
        title,
        testName: title,
        testType: "attribute",
        attributeCheckId: checkId,
        attributeOne,
        attributeTwo,
        skillValue: 30
      }
    }).render({ force: true });
  }

  _onRollSkill(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = this._getSkillItemFromEvent(event);
    if (!item) return;

    new AxiomRollWindow({
      rollData: {
        actor: this.actor,
        item,
        skillItem: item,
        title: `${game.i18n.localize("AXIOM.Roll.SkillTest")}: ${item.name}`,
        testName: item.name,
        testType: "skill",
        attributeOne: item.system.attributeOne ?? "strength",
        attributeTwo: item.system.attributeTwo ?? item.system.attributeOne ?? "strength",
        skillValue: Number(item.system.level ?? 0)
      }
    }).render({ force: true });
  }

  _onRollAttributeCheck(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget.closest("[data-check-id]");
    const selects = row?.querySelectorAll("select[data-action='updateAttributeCheckPreview']") ?? [];

    this._rollAttributeCheck({
      checkId: row?.dataset.checkId ?? "custom",
      checkName: row?.dataset.checkName || game.i18n.localize("AXIOM.Actor.Skills.AttributeCheck"),
      attributeOne: selects[0]?.value ?? "strength",
      attributeTwo: selects[1]?.value ?? "agility"
    });
  }


  async _onUpdateSkillLevel(event) {
    const input = event.currentTarget;
    const itemId = input.closest("[data-skill-id]")?.dataset.skillId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) return;

    const rawLevel = Number(input.value) || 0;
    const level = Math.min(50, Math.max(0, rawLevel));
    input.value = level;

    await item.update({ "system.level": level });
  }

  static async _onSubmitForm(event, form, formData) {
    const updateData = foundry.utils.expandObject(formData.object);

    if (updateData.system?.currency?.coins) {
      updateData.system.currency.value = String(priceCoinsToValue(updateData.system.currency.coins));
    }

    if (updateData.name === undefined) delete updateData.name;
    if (updateData.img === undefined) delete updateData.img;

    await this.actor.update(updateData);
  }
}
