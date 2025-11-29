import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomArmorItemSheet extends axiomBaseItemSheet {

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
