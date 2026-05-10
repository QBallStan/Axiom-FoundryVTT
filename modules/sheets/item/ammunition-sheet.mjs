import AxiomItemSheet from "./base.mjs";

export default class AxiomAmmunitionSheet extends AxiomItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet", "ammunition"],
    position: { width: 520, height: 500 }
  }, { inplace: false });

  static TABS = {
    sheet: {
      tabs: [
        { id: "description", icon: "fa-solid fa-align-left", label: "AXIOM.Item.Tabs.Description" }
      ],
      initial: "description"
    }
  };
}
