import AxiomBaseItemSheet from "./itemBaseSheet.js";

export default class AxiomWeaponItemSheet extends AxiomBaseItemSheet {

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
