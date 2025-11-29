import AxiomBaseItemSheet from "./itemBaseSheet.js";

export default class AxiomSkillItemSheet extends AxiomBaseItemSheet {

  static DEFAULT_OPTIONS = {
    item: {
      type: "skill",
      isPhysical: false
    }
  };

  static {
    this._initializeItemSheetClass();
  }
}
