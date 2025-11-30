import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomEquipmentItemSheet extends axiomBaseItemSheet {
  static DEFAULT_OPTIONS = {
    item: {
      type: "equipment",
      isPhysical: true
    }
  };

  static {
    // Run base initialization
    this._initializeItemSheetClass();

    // Remove Details + Effects PARTS
    delete this.PARTS.details;
    delete this.PARTS.effects;

    // Keep only Description tab
    this.TABS.sheet = this.TABS.sheet.filter(t => t.id === "description");
  }
}
