import AxiomItemSheet from "./base.mjs";

export default class AxiomWeaponSheet extends AxiomItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet", "weapon"],
    position: { width: 560, height: 640 }
  }, { inplace: false });
}
