import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomWeaponItemSheet extends axiomBaseItemSheet {
  static DEFAULT_OPTIONS = {
    item: {
      type: "weapon",
      isPhysical: true,
    },
  };

  static {
    this._initializeItemSheetClass();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const actor = this.document.parent;
    if (actor) {
      context.ammoItems = actor.items.filter((i) => i.type === "ammunition");
    } else {
      context.ammoItems = [];
    }

    return context;
  }
}
