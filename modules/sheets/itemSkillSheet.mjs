import axiomBaseItemSheet from "./itemBaseSheet.mjs";

export default class axiomSkillItemSheet extends axiomBaseItemSheet {
  static DEFAULT_OPTIONS = {
    item: {
      type: "skill",
      isPhysical: false,
    },
  };

  static {
    // Run base initialization
    this._initializeItemSheetClass();

    // Remove the Effects PART for skills
    delete this.PARTS.effects;

    // Remove the Effects tab from TABS.sheet
    this.TABS.sheet = this.TABS.sheet.filter((t) => t.id !== "effects");
  }
}
