import AxiomItemSheet from "./base.mjs";

export default class AxiomRangedWeaponSheet extends AxiomItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet", "weapon", "ranged-weapon"],
    position: { width: 520, height: 520 }
  }, { inplace: false });
}
