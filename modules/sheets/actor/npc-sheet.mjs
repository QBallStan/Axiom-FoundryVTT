import AxiomActorSheet from "./base.mjs";

export default class AxiomNpcSheet extends AxiomActorSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "sheet", "actor", "npc"],
    position: {
      width: 760,
      height: 920
    }
  }, { inplace: false });

  static PARTS = {
    form: {
      template: "systems/axiom/templates/sheets/actor/npc-sheet.hbs"
    }
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "main", icon: "fa-solid fa-table-cells-large", label: "AXIOM.Actor.Tabs.Main" },
        { id: "combat", icon: "fa-solid fa-swords", label: "AXIOM.Actor.Tabs.CombatGear" },
        { id: "effects", icon: "fa-solid fa-bolt", label: "AXIOM.Actor.Tabs.Effects" },
        { id: "notes", icon: "fa-solid fa-note-sticky", label: "AXIOM.Actor.Tabs.Notes" }
      ],
      initial: "main"
    }
  };
}
