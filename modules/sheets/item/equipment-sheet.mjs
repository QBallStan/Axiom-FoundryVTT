import AxiomItemSheet from "./base.mjs";

export default class AxiomEquipmentSheet extends AxiomItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "item", "item-sheet", "equipment"],
    position: { width: 520, height: 500 }
  }, { inplace: false });

  static TABS = {
    sheet: {
      tabs: [
        { id: "description", icon: "fa-solid fa-align-left", label: "AXIOM.Item.Tabs.Description" },
        { id: "details", icon: "fa-solid fa-sliders", label: "AXIOM.Item.Tabs.Details" },
        { id: "effects", icon: "fa-solid fa-bolt", label: "AXIOM.Item.Tabs.Effects" }
      ],
      initial: "description"
    }
  };
}
