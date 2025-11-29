import axiomBaseItemSheet from "./itemBaseSheet.js";

export default class axiomSkillItemSheet extends axiomBaseItemSheet {

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
