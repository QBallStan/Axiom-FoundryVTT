const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { mergeObject } = foundry.utils;
import { getStoredPriceCoins, prepareCurrencyContext, priceCoinsToValue } from "../../system/currency.mjs";
import { getWeaponCategory, isMeleeWeaponItem, isRangedWeaponItem, isWeaponItem } from "../../system/items.mjs";


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
    context.weapon = this._prepareWeaponContext(context.system);
    context.equipment = this._prepareEquipmentContext(context.system);

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

  _prepareWeaponContext(system = {}) {
    const range = Number(system.range ?? 0);
    const category = getWeaponCategory(this.item);
    const isRanged = isRangedWeaponItem(this.item);

    return {
      category,
      isMelee: isMeleeWeaponItem(this.item),
      isRanged,
      skills: this._getWeaponSkillNameOptions(),
      ammunition: this._getAmmunitionOptions(),
      rangeBands: {
        short: Math.ceil(range / 2),
        medium: range,
        long: range * 2,
        extreme: range * 3
      }
    };
  }


  _prepareCurrencyContext(system = {}) {
    const currency = prepareCurrencyContext();
    return {
      ...currency,
      itemPriceCoins: getStoredPriceCoins(system),
      itemPriceValue: Number(system.price ?? 0) || 0
    };
  }

  _prepareEquipmentContext(system = {}) {
    return {
      skills: this._getSkillOptions(system.skill)
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

  _getSkillOptions() {
    const skills = this._getActorItems()
      .filter(item => item.type === "skill")
      .sort((a, b) => a.name.localeCompare(b.name));

    return Object.fromEntries(skills.map(item => [item.id, item.name]));
  }

  _getWeaponSkillNameOptions() {
    return this._getActorItems()
      .filter(item => item.type === "skill")
      .map(item => item.name)
      .sort((a, b) => a.localeCompare(b));
  }

  _getAmmunitionOptions() {
    const ammunition = this._getActorItems()
      .filter(item => item.type === "ammunition")
      .sort((a, b) => a.name.localeCompare(b.name));

    return Object.fromEntries(ammunition.map(item => [item.id, item.name]));
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
      img: effect.img ?? effect.icon ?? "icons/svg/aura.svg",
      disabled: Boolean(effect.disabled)
    }));

    return {
      active: effects.filter(effect => !effect.disabled),
      disabled: effects.filter(effect => effect.disabled)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

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
  }

  async _onCreateEffect(event) {
    event.preventDefault();
    const [effect] = await this.item.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("AXIOM.Item.Effects.New"),
      icon: "icons/svg/aura.svg",
      disabled: false
    }]);
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

    await this.item.update(updateData);
  }
}
