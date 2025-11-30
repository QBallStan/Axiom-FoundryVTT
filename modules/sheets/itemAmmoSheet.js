import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomAmmoItemSheet extends axiomBaseItemSheet {
  static DEFAULT_OPTIONS = {
    item: {
      type: "ammo",
      isPhysical: true
    }
  };

  static {
    // Run base initialization
    this._initializeItemSheetClass();

    // Remove Details + Effects PARTS entirely
    delete this.PARTS.details;
    delete this.PARTS.effects;

    // Keep only the Description tab
    this.TABS.sheet = this.TABS.sheet.filter(t => t.id === "description");
  }
}
