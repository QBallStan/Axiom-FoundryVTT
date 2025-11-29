const api = foundry.applications.api;
const sheets = foundry.applications.sheets;

export default class axiomCharacterSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  sheetContext = {};

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["axiom", "sheet", "characterSheet"],
    actions: {},
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 800,
      height: 900,
    },
  };

  static PARTS = {
    sidebar: {
      template: "systems/axiom/templates/actor/sidebar.hbs",
    },

    tabs: {
      template: "systems/axiom/templates/actor/tabs.hbs",
    },
  };

  get title() {
    return this.actor.name;
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);

    // Limit what part of the sheets can be viewed by limited users

    // if (this.document.limited) options.parts = ["part name"]
    // else option.parts = ["parts name"]
  }

  /** @override */
  async _prepareContext(options) {
    // Creates basic datamodel. Used to fill the HTML together with Handlebars with data.

    const baseData = await super._prepareContext();

    const context = {
      // Set general values
      owner: baseData.document.isOwner,
      editable: baseData.editable,
      actor: baseData.document,
      system: baseData.document.system,
      items: baseData.document.items,
      config: CONFIG.AXIOM,
      isGM: baseData.user.isGM,
      effects: baseData.document.effects,
    };

    this.sheetContext = context;

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Main tabs (skills, equipment, details, etc.)
    const mainTabs = new foundry.applications.ux.Tabs({
      navSelector: ".sheet-tabs",
      contentSelector: ".sheet-content",
      initial: "skills", // must match your first tab's data-tab!
    });
    mainTabs.bind(this.element);

    // Sidebar tabs (attribute tests / physical limits)
    const sidebarTabs = new foundry.applications.ux.Tabs({
      navSelector: ".sidebar-tabs",
      contentSelector: ".sidebar-content",
      initial: "attr-tests", // must match your first sidebar tab
    });
    sidebarTabs.bind(this.element);
  }
}
