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
      width: 650,
    },
  };

  static PARTS = {

    sidebar: { template: "systems/axiom/templates/sheets/character/sidebar.hbs" },
    trackers: { template: "systems/axiom/templates/sheets/character/trackers.hbs" },
    main: { template: "systems/axiom/templates/sheets/character/main.hbs" },
    
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
    const tabs = new foundry.applications.ux.Tabs({
      navSelector: ".tabs",
      contentSelector: ".content",
      initial: "tab1",
    });
    tabs.bind(this.element);

    const tabs2 = new foundry.applications.ux.Tabs({
      navSelector: ".tabs2",
      contentSelector: ".content",
      initial: "tab2-1",
    });
    tabs2.bind(this.element);
  }
}
