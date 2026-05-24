const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { mergeObject } = foundry.utils;
import { getStoredPriceCoins, prepareCurrencyContext, priceCoinsToValue } from "../../system/currency.mjs";
import AxiomEffectBuilder from "../../apps/effect-builder.mjs";
import { getWeaponCategory, getWeaponRange, getWeaponRangeBands, handStateUsesMainHand, handStateUsesOffHand, isHandEquippableItem, isHandGearState, isMeleeWeaponItem, isRangedWeaponItem, isWeaponItem, isShieldItem } from "../../system/items.mjs";


function normalizeSkillReference(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase(game.i18n.lang)
    .replaceAll(/[^\p{L}\p{N}]+/gu, "");
}

async function getWorldAndCompendiumSkillNames() {
  const names = new Set();

  for (const item of game.items ?? []) {
    if (item?.type === "skill" && item.name) names.add(item.name);
  }

  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;

    try {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      for (const entry of index ?? []) {
        if (entry?.type === "skill" && entry.name) names.add(entry.name);
      }
    } catch (error) {
      console.warn(`Axiom | Could not read skill compendium ${pack.collection}`, error);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function normalizeWeaponReloadMethod(value) {
  const method = String(value ?? "").trim();
  if (["none", "thrown", "drawn", "single"].includes(method)) return method;
  if (method === "free") return "drawn";
  if (["magazine", "speedloader", "breakAction", "beltFed", "internalMagazine", "revolverCylinder", "muzzle"].includes(method)) return "single";
  return "none";
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

export default class AxiomItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet"],
    position: {
      width: 520,
      height: 440
    },
    window: {
      resizable: true
    },
    form: {
      handler: AxiomItemSheet._onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    }
  }, { inplace: false });

  static PARTS = {
    form: {
      template: "systems/axiom/templates/sheets/item/item-sheet.hbs"
    }
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "description", icon: "fa-solid fa-align-left", label: "AXIOM.Item.Tabs.Description" },
        { id: "details", icon: "fa-solid fa-sliders", label: "AXIOM.Item.Tabs.Details" },
        { id: "effects", icon: "fa-solid fa-bolt", label: "AXIOM.Item.Tabs.Effects" }
      ],
      initial: "description"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const source = this.item.toObject();
    const activeTab = this._getActiveTab();

    context.item = this.item;
    context.document = this.item;
    context.source = source;
    context.system = source.system;
    context.fields = this.item.system?.constructor?.schema?.fields ?? this.item.system?.schema?.fields ?? {};
    context.enriched = await this._prepareEnrichedContent();
    context.editorFields = this._prepareEditorFields();
    context.config = this._getConfig();
    context.isSkill = this.item.type === "skill";
    context.isArmor = this.item.type === "armor";
    context.isShield = isShieldItem(this.item);
    context.isWeapon = isWeaponItem(this.item);
    context.isMeleeWeapon = isMeleeWeaponItem(this.item);
    context.isRangedWeapon = isRangedWeaponItem(this.item);
    context.isAmmunition = this.item.type === "ammunition";
    context.isEquipment = this.item.type === "equipment";
    context.isTrait = this.item.type === "trait";
    context.activeTab = activeTab;
    context.tabs = this._getPreparedTabs(activeTab);
    context.tabClasses = Object.fromEntries(
      this.constructor.TABS.sheet.tabs.map(tab => [tab.id, tab.id === activeTab ? "active" : ""])
    );
    context.hasDetailsTab = this._hasTab("details");
    context.hasEffectsTab = this._hasTab("effects");
    context.displayCommonFields = this.constructor.DISPLAY_COMMON_FIELDS ?? true;
    context.currency = this._prepareCurrencyContext(context.system);
    context.skillCategory = {
      core: context.system?.category === "core",
      expertise: context.system?.category === "expertise"
    };
    context.effects = context.hasEffectsTab ? this._prepareEffects() : { active: [], disabled: [] };
    context.weapon = await this._prepareWeaponContext(context.system);
    context.shield = await this._prepareShieldContext(context.system);
    context.equipment = await this._prepareEquipmentContext(context.system);
    context.techLevel = this._prepareTechLevelContext(context.system);

    return context;
  }

  _prepareEditorFields() {
    return {
      description: {
        value: getSystemSchemaField(this.item.system, "description.value")
      }
    };
  }

  async _prepareEnrichedContent() {
    return {
      system: {
        description: {
          value: await enrichHTML(this.item.system.description?.value, this.item)
        }
      }
    };
  }

  _getActiveWeaponModeTab(category, showMeleeTab, showRangedTab) {
    let active = this._activeWeaponModeTab;
    if (category === "ranged" || !showMeleeTab) active = "ranged";
    else if (category === "melee" || !showRangedTab) active = "melee";
    else if (!["melee", "ranged"].includes(active)) active = "melee";
    this._activeWeaponModeTab = active;
    return active;
  }

  async _prepareWeaponContext(system = {}) {
    const actor = this._getOwningActor();
    const range = getWeaponRange(this.item, actor);
    const rangeBands = getWeaponRangeBands(range);
    const baseRange = Math.max(0, Number(system.range ?? 0) || 0);
    const strengthRangeModifier = Number(system.strengthRangeModifier ?? 0) || 0;
    const category = getWeaponCategory(this.item);
    const isMelee = isMeleeWeaponItem(this.item);
    const isRanged = isRangedWeaponItem(this.item);
    const isMixed = category === "mixed";

    const configuredHands = this._getConfig()?.weaponHands ?? {};
    const handsOptions = Object.fromEntries(Object.entries(configuredHands).filter(([key]) => {
      if (category === "ranged") return ["one", "two"].includes(key);
      return true;
    }));

    const loadingMethod = normalizeWeaponReloadMethod(system.reloadMethod);

    return {
      category,
      isMelee,
      isRanged,
      isMixed,
      showMeleeTab: isMelee || isMixed,
      showRangedTab: isRanged || isMixed,
      activeModeTab: this._getActiveWeaponModeTab(category, isMelee || isMixed, isRanged || isMixed),
      meleeSkill: system.meleeSkill || system.skill || "Melee",
      rangedSkill: system.rangedSkill || system.skill || (category === "mixed" ? "Athletics" : "Marksmanship"),
      elemental: system.elemental || "none",
      loadingMethod,
      loadingMethodNone: loadingMethod === "none",
      loadingMethodThrown: loadingMethod === "thrown",
      loadingMethodDrawn: loadingMethod === "drawn",
      loadingMethodSingle: loadingMethod === "single",
      showAmmunitionField: ["drawn", "single"].includes(loadingMethod),
      showShotsField: loadingMethod === "single",
      showReloadCostField: loadingMethod === "single",
      loadingHint: `AXIOM.Weapon.ReloadMethod.Hints.${loadingMethod}`,
      categories: this._getConfig()?.weaponCategories ?? {},
      reloadCosts: this._getConfig()?.weaponReloadCosts ?? {},
      skills: await this._getWeaponSkillNameOptions(),
      ammunition: this._getAmmunitionOptions(),
      handsOptions,
      stateOptions: this._prepareHandGearStateOptions(system.state),
      range,
      baseRange,
      strengthBasedRange: Boolean(system.strengthBasedRange),
      strengthRangeModifier,
      rangeFormulaLabel: Boolean(system.strengthBasedRange)
        ? game.i18n.format("AXIOM.Weapon.RangeFormula.Strength", { modifier: strengthRangeModifier >= 0 ? `+${strengthRangeModifier}` : String(strengthRangeModifier), range })
        : game.i18n.format("AXIOM.Weapon.RangeFormula.Fixed", { range }),
      rangeBands
    };
  }


  async _prepareShieldContext(system = {}) {
    const cover = system.cover ?? "light";

    return {
      cover,
      skills: await this._getWeaponSkillNameOptions(),
      stateOptions: this._prepareHandGearStateOptions(system.state),
      coverLabel: this._localizeConfigLabel(this._getConfig()?.coverTypes?.[cover], cover)
    };
  }


  _prepareTechLevelContext(system = {}) {
    const rawLevel = Number(system.tl ?? 0);
    const selectedLevel = Number.isInteger(rawLevel) ? Math.min(12, Math.max(0, rawLevel)) : 0;
    const configuredLevels = this._getConfig()?.itemTechLevels ?? {};
    const options = Object.entries(configuredLevels).map(([value, data]) => {
      const level = Number(value);
      const name = this._localizeConfigLabel(data?.name, value);
      const description = this._localizeConfigLabel(data?.description, "");
      return {
        value: level,
        name,
        description,
        label: game.i18n.format("AXIOM.Item.TechLevel.Option", { level, name }),
        selected: level === selectedLevel
      };
    });

    return {
      level: selectedLevel,
      selected: options.find(option => option.selected) ?? options[0] ?? null,
      options
    };
  }

  _prepareHandGearStateOptions(selectedState = "carried") {
    let states = this._getConfig()?.handGearStates ?? {};
    if (isWeaponItem(this.item) && this.item.system?.hands === "two") {
      states = Object.fromEntries(Object.entries(states).filter(([key]) => ["bothHands", "carried", "stored"].includes(key)));
    }

    const normalizedState = isWeaponItem(this.item) && this.item.system?.hands === "two" && ["equipped", "mainHand", "offHand"].includes(selectedState)
      ? "bothHands"
      : selectedState === "equipped" ? "mainHand" : (selectedState ?? "carried");
    return Object.entries(states).map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      selected: key === normalizedState
    }));
  }

  async _clearConflictingHandItems(nextState) {
    if (isWeaponItem(this.item) && this.item.system?.hands === "two" && isHandGearState(nextState)) {
      nextState = "bothHands";
    }

    if (!isHandEquippableItem(this.item) || !isHandGearState(nextState)) return;

    const actor = this._getOwningActor();
    if (!actor) return;

    const usesMain = handStateUsesMainHand(nextState);
    const usesOff = handStateUsesOffHand(nextState);
    const updates = actor.items
      .filter(item => item.id !== this.item.id && isHandEquippableItem(item))
      .filter(item => {
        const state = item.system?.state;
        return (usesMain && handStateUsesMainHand(state)) || (usesOff && handStateUsesOffHand(state));
      })
      .map(item => ({ _id: item.id, "system.state": "carried" }));

    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }

  _prepareCurrencyContext(system = {}) {
    const currency = prepareCurrencyContext();
    return {
      ...currency,
      itemPriceCoins: getStoredPriceCoins(system),
      itemPriceValue: Number(system.price ?? 0) || 0
    };
  }

  async _prepareEquipmentContext(system = {}) {
    return {
      skills: await this._getSkillOptions(system.skill)
    };
  }

  _getOwningActor() {
    const parent = this.item.parent;
    if (parent?.documentName === "Actor") return parent;
    if (this.item.actor?.documentName === "Actor") return this.item.actor;
    return null;
  }

  _getActorItems() {
    return Array.from(this._getOwningActor()?.items ?? []);
  }

  async _getSkillOptions(selected = "") {
    const options = new Map();
    const selectedValue = String(selected ?? "");

    for (const item of this._getActorItems().filter(item => item.type === "skill")) {
      options.set(item.id, item.name);
      options.set(item.name, item.name);
    }

    for (const name of await getWorldAndCompendiumSkillNames()) {
      if (!options.has(name)) options.set(name, name);
    }

    if (selectedValue && !options.has(selectedValue)) options.set(selectedValue, selectedValue);

    return Object.fromEntries(Array.from(options.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]))));
  }

  async _getWeaponSkillNameOptions() {
    const names = new Set(this._getActorItems()
      .filter(item => item.type === "skill")
      .map(item => item.name)
      .filter(Boolean));

    for (const name of await getWorldAndCompendiumSkillNames()) names.add(name);

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  _getAmmunitionOptions() {
    const ammunition = this._getActorItems()
      .filter(item => item.type === "ammunition")
      .sort((a, b) => a.name.localeCompare(b.name));

    return Object.fromEntries(ammunition.map(item => [item.id, item.name]));
  }

  _localizeConfigLabel(label, fallback = "") {
    if (!label) return fallback;
    return game.i18n.localize(label);
  }

  _getConfig() {
    const fallback = {
      attributes: {
        strength: "AXIOM.Attributes.Strength",
        agility: "AXIOM.Attributes.Agility",
        fortitude: "AXIOM.Attributes.Fortitude",
        logic: "AXIOM.Attributes.Logic",
        resolve: "AXIOM.Attributes.Resolve",
        charisma: "AXIOM.Attributes.Charisma",
        instinct: "AXIOM.Attributes.Instinct",
        power: "AXIOM.Attributes.Power"
      },
      skillCategories: {
        core: "AXIOM.Skill.Categories.Core",
        expertise: "AXIOM.Skill.Categories.Expertise"
      },
      traitCategories: {
        quality: "AXIOM.Trait.Categories.Quality",
        flaw: "AXIOM.Trait.Categories.Flaw"
      },
      coverTypes: {
        light: "AXIOM.Shield.Cover.Light",
        medium: "AXIOM.Shield.Cover.Medium",
        heavy: "AXIOM.Shield.Cover.Heavy"
      },
      itemTechLevels: {
        0: { name: "AXIOM.Item.TechLevel.Names.0", description: "AXIOM.Item.TechLevel.Descriptions.0" },
        1: { name: "AXIOM.Item.TechLevel.Names.1", description: "AXIOM.Item.TechLevel.Descriptions.1" },
        2: { name: "AXIOM.Item.TechLevel.Names.2", description: "AXIOM.Item.TechLevel.Descriptions.2" },
        3: { name: "AXIOM.Item.TechLevel.Names.3", description: "AXIOM.Item.TechLevel.Descriptions.3" },
        4: { name: "AXIOM.Item.TechLevel.Names.4", description: "AXIOM.Item.TechLevel.Descriptions.4" },
        5: { name: "AXIOM.Item.TechLevel.Names.5", description: "AXIOM.Item.TechLevel.Descriptions.5" },
        6: { name: "AXIOM.Item.TechLevel.Names.6", description: "AXIOM.Item.TechLevel.Descriptions.6" },
        7: { name: "AXIOM.Item.TechLevel.Names.7", description: "AXIOM.Item.TechLevel.Descriptions.7" },
        8: { name: "AXIOM.Item.TechLevel.Names.8", description: "AXIOM.Item.TechLevel.Descriptions.8" },
        9: { name: "AXIOM.Item.TechLevel.Names.9", description: "AXIOM.Item.TechLevel.Descriptions.9" },
        10: { name: "AXIOM.Item.TechLevel.Names.10", description: "AXIOM.Item.TechLevel.Descriptions.10" },
        11: { name: "AXIOM.Item.TechLevel.Names.11", description: "AXIOM.Item.TechLevel.Descriptions.11" },
        12: { name: "AXIOM.Item.TechLevel.Names.12", description: "AXIOM.Item.TechLevel.Descriptions.12" }
      },
      handGearStates: {
        mainHand: "AXIOM.Item.State.MainHand",
        offHand: "AXIOM.Item.State.OffHand",
        bothHands: "AXIOM.Item.State.BothHands",
        carried: "AXIOM.Item.State.Carried",
        stored: "AXIOM.Item.State.Stored"
      },
      weaponHands: {
        one: "AXIOM.Weapon.Hands.One",
        two: "AXIOM.Weapon.Hands.Two",
        versatile: "AXIOM.Weapon.Hands.Versatile"
      },
      weaponCategories: {
        melee: "AXIOM.Weapon.Categories.Melee",
        ranged: "AXIOM.Weapon.Categories.Ranged",
        mixed: "AXIOM.Weapon.Categories.Mixed"
      },
      elementalDamage: {
        none: "AXIOM.Weapon.Elemental.None",
        fire: "AXIOM.Weapon.Elemental.Fire",
        cold: "AXIOM.Weapon.Elemental.Cold",
        electric: "AXIOM.Weapon.Elemental.Electric",
        acid: "AXIOM.Weapon.Elemental.Acid",
        corruption: "AXIOM.Weapon.Elemental.Corruption",
        radiant: "AXIOM.Weapon.Elemental.Radiant",
        necrotic: "AXIOM.Weapon.Elemental.Necrotic",
        psychic: "AXIOM.Weapon.Elemental.Psychic"
      },
      weaponReloadCosts: {
        0: "AXIOM.Weapon.ReloadCost.Free",
        1: "AXIOM.Weapon.ReloadCost.OneAP",
        2: "AXIOM.Weapon.ReloadCost.TwoAP",
        3: "AXIOM.Weapon.ReloadCost.ThreeAP"
      },
      weaponReloadMethods: {
        none: "AXIOM.Weapon.ReloadMethod.None",
        thrown: "AXIOM.Weapon.ReloadMethod.Thrown",
        drawn: "AXIOM.Weapon.ReloadMethod.Drawn",
        single: "AXIOM.Weapon.ReloadMethod.Single"
      }
    };

    return foundry.utils.mergeObject(fallback, CONFIG.AXIOM ?? {}, { inplace: false });
  }

  _getActiveTab() {
    return this.tabGroups?.sheet ?? this.constructor.TABS.sheet.initial ?? "description";
  }

  _hasTab(tabId) {
    return this.constructor.TABS.sheet.tabs.some(tab => tab.id === tabId);
  }

  _getPreparedTabs(activeTab = this._getActiveTab()) {
    return this.constructor.TABS.sheet.tabs.map(tab => ({
      ...tab,
      active: tab.id === activeTab,
      cssClass: tab.id === activeTab ? "active" : ""
    }));
  }

  _prepareEffects() {
    const effects = Array.from(this.item.effects ?? []).map(effect => ({
      id: effect.id,
      name: effect.name,
      img: effect.img ?? effect.icon ?? "systems/axiom/assets/icons/effect.svg",
      disabled: Boolean(effect.disabled)
    }));

    return {
      active: effects.filter(effect => !effect.disabled),
      disabled: effects.filter(effect => effect.disabled)
    };
  }

  _adjustHeightToContent() {
    if (!this.rendered || !this.element) return;

    window.requestAnimationFrame(() => {
      const minHeight = this.constructor.DEFAULT_OPTIONS?.position?.height ?? 440;
      const maxHeight = Math.max(minHeight, window.innerHeight - 40);
      const content = this.element.querySelector(".axiom-item-sheet");
      const header = this.element.querySelector(".window-header")?.offsetHeight ?? 0;
      const bodyHeight = content?.scrollHeight ?? this.element.scrollHeight ?? minHeight;
      const targetHeight = Math.min(maxHeight, Math.max(minHeight, Math.ceil(bodyHeight + header + 8)));

      if (Math.abs(Number(this.position?.height ?? 0) - targetHeight) > 4) {
        this.setPosition({ height: targetHeight });
      }
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._adjustHeightToContent();

    this.element.querySelectorAll("[data-action='configureTechLevel']").forEach(element => {
      element.addEventListener("click", this._onConfigureTechLevel.bind(this));
    });

    this.element.querySelectorAll("[data-action='createEffect']").forEach(element => {
      element.addEventListener("click", this._onCreateEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='editEffect']").forEach(element => {
      element.addEventListener("click", this._onEditEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleEffect']").forEach(element => {
      element.addEventListener("click", this._onToggleEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='deleteEffect']").forEach(element => {
      element.addEventListener("click", this._onDeleteEffect.bind(this));
    });

    this.element.querySelectorAll("[data-action='selectWeaponModeTab']").forEach(element => {
      element.addEventListener("click", this._onSelectWeaponModeTab.bind(this));
    });

    this.element.querySelectorAll("[data-tab]").forEach(element => {
      element.addEventListener("click", () => this._adjustHeightToContent());
    });
  }

  _onSelectWeaponModeTab(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const mode = button?.dataset?.weaponModeTab;
    if (!mode) return;
    this._activeWeaponModeTab = mode;

    const root = button.closest(".weapon-mode-tabs-section");
    if (!root) return;

    root.querySelectorAll("[data-action='selectWeaponModeTab']").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.weaponModeTab === mode);
    });

    root.querySelectorAll("[data-weapon-mode-panel]").forEach(panel => {
      panel.hidden = panel.dataset.weaponModePanel !== mode;
    });

    this._adjustHeightToContent();
  }


  _buildTechLevelDialogContent() {
    const options = this._prepareTechLevelContext(this.item.system).options;
    const hint = game.i18n.localize("AXIOM.Item.TechLevel.Hint");

    const radios = options.map(option => `
      <label class="axiom-tech-level-option" data-tooltip="${escapeHTML(option.description)}">
        <input type="radio" name="techLevel" value="${option.value}" ${option.selected ? "checked" : ""}>
        <span>${escapeHTML(option.label)}</span>
      </label>
    `).join("");

    return `
      <div class="axiom-tech-level-dialog">
        <p class="hint">${escapeHTML(hint)}</p>
        <div class="axiom-tech-level-option-grid">${radios}</div>
      </div>
    `;
  }

  async _onConfigureTechLevel(event) {
    event.preventDefault();

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2?.prompt) return;

    let level;
    try {
      level = await DialogV2.prompt({
        window: { title: game.i18n.localize("AXIOM.Item.TechLevel.Configure") },
        classes: ["axiom", "axiom-tech-level-app"],
        position: { width: 560, height: "auto" },
        modal: true,
        content: this._buildTechLevelDialogContent(),
        ok: {
          label: game.i18n.localize("AXIOM.Common.Save"),
          callback: (event, button) => Number(button.form?.elements?.techLevel?.value ?? this.item.system?.tl ?? 0)
        },
        rejectClose: false
      });
    } catch {
      return;
    }

    if (!Number.isFinite(level)) return;
    level = Math.min(12, Math.max(0, Math.trunc(level)));
    await this.item.update({ "system.tl": level });
    this._adjustHeightToContent();
  }


  async _onCreateEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const effect = await AxiomEffectBuilder.prompt(this.item);
    effect?.sheet?.render(true);
  }

  _getEffect(event) {
    const effectId = event.currentTarget.closest("[data-effect-id]")?.dataset.effectId;
    return effectId ? this.item.effects.get(effectId) : null;
  }

  _onEditEffect(event) {
    event.preventDefault();
    this._getEffect(event)?.sheet?.render(true);
  }

  async _onToggleEffect(event) {
    event.preventDefault();
    const effect = this._getEffect(event);
    if (!effect) return;
    await effect.update({ disabled: !effect.disabled });
  }

  async _onDeleteEffect(event) {
    event.preventDefault();
    const effect = this._getEffect(event);
    if (!effect) return;
    await effect.delete();
  }

  static async _onSubmitForm(event, form, formData) {
    const updateData = foundry.utils.expandObject(formData.object);

    if (updateData.system?.priceCoins) {
      updateData.system.price = String(priceCoinsToValue(updateData.system.priceCoins));
    }

    if (updateData.name === undefined) delete updateData.name;
    if (updateData.img === undefined) delete updateData.img;

    if (isWeaponItem(this.item) && updateData.system) {
      updateData.system.strengthBasedRange = Boolean(updateData.system.strengthBasedRange);
    }

    const nextReloadMethod = normalizeWeaponReloadMethod(updateData.system?.reloadMethod ?? this.item.system?.reloadMethod);
    if (["none", "thrown", "drawn"].includes(nextReloadMethod) && updateData.system) {
      updateData.system.ammo = 0;
      updateData.system.ammoContainer = 0;
    }

    if (updateData.system?.hands === "two" && isHandGearState(updateData.system?.state ?? this.item.system?.state)) {
      updateData.system.state = "bothHands";
    }

    if (updateData.system?.state) {
      await this._clearConflictingHandItems(updateData.system.state);
    }

    await this.item.update(updateData);
  }
}
