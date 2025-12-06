import axiomBaseItemSheet from "./itemBaseSheet.mjs";

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
