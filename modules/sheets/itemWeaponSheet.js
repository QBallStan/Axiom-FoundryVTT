import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomWeaponItemSheet extends axiomBaseItemSheet {

  static DEFAULT_OPTIONS = {
    item: {
      type: "weapon",
      isPhysical: true
    }
  };

  static {
    this._initializeItemSheetClass();
  }
}
