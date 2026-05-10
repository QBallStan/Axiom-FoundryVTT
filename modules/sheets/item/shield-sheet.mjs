import AxiomItemSheet from "./base.mjs";

export default class AxiomShieldSheet extends AxiomItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet", "shield"],
    position: { width: 520, height: 500 }
  }, { inplace: false });
}
