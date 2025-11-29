const { api, sheets } = foundry.applications;
const { ItemSheetV2 } = sheets;

/**
 * Axiom Base Item Sheet built in the same architecture as Crucible.
 */
export default class AxiomBaseItemSheet extends api.HandlebarsApplicationMixin(ItemSheetV2) {

  /* -------------------------------------------- */
  /*  DEFAULT OPTIONS                              */
  /* -------------------------------------------- */
  static DEFAULT_OPTIONS = {
    classes: ["axiom", "item"],
    tag: "form",
    position: {
      width: 600,
      height: 600
    },
    form: {
      submitOnChange: true
    },
    item: {
      type: undefined,     // subclass sets this
      isPhysical: false    // subclass sets this
    },
    window: {
      resizable: true
    }
  };

  /* -------------------------------------------- */
  /*  PARTS                                        */
  /* -------------------------------------------- */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/axiom/templates/item/header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "systems/axiom/templates/item/tabs.hbs"
    },
    description: {
      id: "description",
      template: "systems/axiom/templates/item/tabs/description.hbs"
    },
    details: {
      id: "details",
      template: undefined   // Set in _initializeItemSheetClass
    },
    effects: {
      id: "effects",
      template: "systems/axiom/templates/item/tabs/effects.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  TABS                                         */
  /* -------------------------------------------- */
  static TABS = {
    sheet: [
      { id: "description", group: "sheet", icon: "fa-solid fa-book", label: "AXIOM.Description" },
      { id: "details",     group: "sheet", icon: "fa-solid fa-gear", label: "AXIOM.Details" },
      { id: "effects",     group: "sheet", icon: "fa-solid fa-wand-magic-sparkles", label: "AXIOM.Effects" }
    ]
  };

  /* -------------------------------------------- */
  /*  Default Active Tab                           */
  /* -------------------------------------------- */
  tabGroups = {
    sheet: "description"
  };

  /* -------------------------------------------- */
  /*  STATIC INITIALIZER                           */
  /* -------------------------------------------- */
  static _initializeItemSheetClass() {
    const item = this.DEFAULT_OPTIONS.item;

    // Deep clone PARTS and TABS so subclasses do not mutate the base class
    this.PARTS = foundry.utils.deepClone(this.PARTS);
    this.TABS  = foundry.utils.deepClone(this.TABS);

    // Assign the correct details template for the item type
    if (item.type) {
      this.PARTS.details.template =
        `systems/axiom/templates/item/types/${item.type}.hbs`;
    }

    // Replace CSS classes exactly as Crucible does
    this.DEFAULT_OPTIONS.classes = [
      "axiom",
      "item",
      `item-${item.type}`
    ];
  }

  /* -------------------------------------------- */
  /*  PREPARE CONTEXT                              */
  /* -------------------------------------------- */
  async _prepareContext(options) {
    const tabGroups = this._getTabs();
    const source    = this.document.toObject();

    const context = {
      item: this.document,
      source,
      system: source.system,
      editable: this.isEditable,
      isEditable: this.isEditable,
      owner: this.document.isOwner,
      isGM: game.user.isGM,
      isPhysical: this.options.item.isPhysical,
      tabGroups,
      tabs: tabGroups.sheet,
      tabsPartial: this.constructor.PARTS.tabs.template,
      config: CONFIG.AXIOM || {}
    };

    return context;
  }

  /* -------------------------------------------- */
  /*  PART CONTEXTS                                */
  /* -------------------------------------------- */
  async _preparePartContext(partId, context) {
    switch (partId) {

      case "description": {
        const editorCls = CONFIG.ux.TextEditor;
        const src = context.system.description ?? "";
        context.description = {
          tab: context.tabs.description,
          publicSrc: src,
          publicHTML: await editorCls.enrichHTML(src, {
            relativeTo: this.document,
            secrets: this.document.isOwner
          })
        };
        break;
      }

      case "effects": {
        context.effects = this.document.effects.contents;
        break;
      }
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  TAB GENERATION (Crucible exact pattern)      */
  /* -------------------------------------------- */
  _getTabs() {
    const tabs = {};

    for (const [groupId, config] of Object.entries(this.constructor.TABS)) {
      const group = {};

      for (const t of config) {
        const active = this.tabGroups[t.group] === t.id;
        group[t.id] = {
          ...t,
          active,
          cssClass: active ? "active" : ""
        };
      }
      tabs[groupId] = group;
    }

    return tabs;
  }

  /* -------------------------------------------- */
  /*  TITLE                                        */
  /* -------------------------------------------- */
  get title() {
    return this.document.name;
  }
}
