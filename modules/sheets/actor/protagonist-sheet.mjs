import AxiomActorSheet from "./base.mjs";

export default class AxiomProtagonistSheet extends AxiomActorSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "actor", "protagonist"]
  }, { inplace: false });
}
