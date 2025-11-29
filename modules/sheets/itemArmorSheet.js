import AxiomBaseItemSheet from "./itemBaseSheet.js";

export default class AxiomArmorItemSheet extends AxiomBaseItemSheet {

  static DEFAULT_OPTIONS = {
    item: {
      type: "armor",
      isPhysical: true
    }
  };

  static {
    this._initializeItemSheetClass();
  }
}
