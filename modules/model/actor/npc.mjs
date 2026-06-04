import AxiomActorBaseData from "./base.mjs";
import { AxiomNpcTrackersModel } from "./components/trackers.mjs";

const fields = foundry.data.fields;

export default class AxiomNpcData extends AxiomActorBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/actors/npc.svg";
  static DEFAULT_TOKEN_ICON = "systems/axiom/assets/icons/actors/npc.svg";

  static defineSchema() {
    const schema = super.defineSchema();
    schema.trackers = new fields.EmbeddedDataField(AxiomNpcTrackersModel);
    return schema;
  }
}
