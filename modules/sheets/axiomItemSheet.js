const api = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export default class AxiomItemSheet extends api.HandlebarsApplicationMixin(
  ItemSheetV2
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["axiom", "sheet", "itemSheet"],
    actions: {},
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 600,
      height: 550,
    },
  };

  static TABS = {
    description: { id: "description", group: "primary", label: "Description" },
    details: { id: "details", group: "primary", label: "Details" },
    effects: { id: "effects", group: "primary", label: "Effects" },
  };

  static PARTS = {
    header: {
      template: "systems/axiom/templates/item/header.hbs",
      classes: ["sheet-header"],
    },

    tabs: {
      template: "systems/axiom/templates/item/tabs.hbs",
    },

    description: {
      template: "systems/axiom/templates/item/tabs/description.hbs",
    },

    details: {
      template: "systems/axiom/templates/item/types/{{type}}.hbs",
    },

    effects: {
      template: "systems/axiom/templates/item/tabs/effects.hbs",
    },
  };

  get title() {
    return this.item.name;
  }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const system = base.document.system ?? {};

    const context = {
      owner: base.document.isOwner,
      editable: base.editable,
      item: base.document,
      system,
      type: base.document.type,
      config: CONFIG.AXIOM,
      isGM: base.user.isGM,
      effects: base.document.effects,
    };

    // Flag: this item uses the "physical" header layout
    context.isPhysical = [
      "weapon",
      "armor",
      "gear",
      "equipment",
      "cyberware",
      "ammo",
      "consumable",
    ].includes(context.type);

    // Enrich description for the description partial
    context.enrichedDescription =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.description ?? "",
        { async: true, secrets: this.item.isOwner }
      );

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const mainTabs = new foundry.applications.ux.Tabs({
      navSelector: ".item-tabs",
      contentSelector: ".item-content",
      initial: "description",
    });

    mainTabs.bind(this.element);
  }
}
