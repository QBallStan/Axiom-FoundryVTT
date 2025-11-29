const { api, sheets } = foundry.applications;

/**
 * Axiom Character sheet (ActorSheetV2 + Handlebars).
 */
export default class axiomCharacterSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  /* -------------------------------------------- */
  /*  Default Options                             */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    classes: ["axiom", "actor", "character"],
    tag: "form",
    position: {
      width: 800,
      height: 900,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actor: {
      type: "character",
    },
    actions: {},
  };

  /* -------------------------------------------- */
  /*  Sheet Parts                                 */
  /* -------------------------------------------- */

  static PARTS = {
    // Sidebar column (portrait, trackers, mini-tabs header)
    sidebar: {
      id: "sidebar",
      template: "systems/axiom/templates/actor/sidebar.hbs",
    },

    // Main tabs header / container
    tabs: {
      id: "tabs",
      template: "systems/axiom/templates/actor/tabs.hbs",
    },

    // Sidebar mini-tabs (attribute tests / physical limits)
    "attribute-tests": {
      id: "attribute-tests",
      template: "systems/axiom/templates/actor/mini-tabs/attribute-tests.hbs",
    },
    "physical-limits": {
      id: "physical-limits",
      template: "systems/axiom/templates/actor/mini-tabs/physical-limits.hbs",
    },

    // Main tabs
    skills: {
      id: "skills",
      template: "systems/axiom/templates/actor/tabs/skills.hbs",
    },
    combat: {
      id: "combat",
      template: "systems/axiom/templates/actor/tabs/combat.hbs",
    },
    inventory: {
      id: "inventory",
      template: "systems/axiom/templates/actor/tabs/inventory.hbs",
    },
    details: {
      id: "details",
      template: "systems/axiom/templates/actor/tabs/details.hbs",
    },
  };

  /* -------------------------------------------- */
  /*  Tab Definitions                             */
  /* -------------------------------------------- */

  static TABS = {
    sheet: [
      {
        id: "skills",
        group: "sheet",
        label: "AXIOM.Skills",
        icon: "fas fa-graduation-cap",
      },
      {
        id: "combat",
        group: "sheet",
        label: "AXIOM.Combat",
        icon: "fas fa-fist-raised",
      },
      {
        id: "inventory",
        group: "sheet",
        label: "AXIOM.Inventory",
        icon: "fas fa-box-open",
      },
      {
        id: "details",
        group: "sheet",
        label: "AXIOM.Details",
        icon: "fas fa-info-circle",
      },
    ],
    sidebar: [
      {
        id: "attribute-tests",
        group: "sidebar",
        label: "AXIOM.AttributeTests",
      },
      {
        id: "physical-limits",
        group: "sidebar",
        label: "AXIOM.PhysicalLimits",
      },
    ],
  };

  /**
   * Default active tab for each group.
   */
  tabGroups = {
    sheet: "skills",
    sidebar: "attribute-tests",
  };

  /* -------------------------------------------- */
  /*  Basic getters                               */
  /* -------------------------------------------- */

  get title() {
    return this.document?.name ?? game.i18n.localize("AXIOM.Actor.Character");
  }

  /* -------------------------------------------- */
  /*  Render options                              */
  /* -------------------------------------------- */

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // If you ever want limited users to see fewer parts, do it here by
    // filtering options.parts.
  }

  /* -------------------------------------------- */
  /*  Context preparation                         */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const actor = base.document;
    const system = actor.system ?? {};

    const tabs = this._getTabs();

    return {
      actor,
      system,
      items: actor.items,
      owner: actor.isOwner,
      editable: base.editable,
      isGM: base.user.isGM,
      effects: actor.effects,
      config: CONFIG.AXIOM,

      // Tabs
      tabGroups: this.tabGroups,
      tabs,
    };
  }

  /**
   * Per-part context hook. Left very light for now.
   * You can extend this later if some parts need extra prep.
   */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case "skills":
        // Example: later you might pre-group skills here.
        break;

      case "combat":
        // Example: prepare derived combat values here.
        break;

      case "inventory":
        // Example: sort or group items before rendering.
        break;

      case "details":
        // Example: enrich any long text fields here.
        break;

      case "attribute-tests":
      case "physical-limits":
        // Sidebar mini-tabs can already use actor/system directly.
        break;
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  Tabs helper                                 */
  /* -------------------------------------------- */

  /**
   * Build the tab data structure from the static TABS config,
   * marking which tab is currently active for each group.
   */
  _getTabs() {
    const tabs = {};

    for (const [groupId, config] of Object.entries(this.constructor.TABS)) {
      const group = {};
      for (const t of config) {
        const active = this.tabGroups[t.group] === t.id;
        group[t.id] = Object.assign(
          {
            active,
            cssClass: active ? "active" : "",
          },
          t
        );
      }
      tabs[groupId] = group;
    }

    return tabs;
  }
}
