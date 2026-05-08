const fields = foundry.data.fields;

function trackerField({ current = 0, min = 0, max = 0 } = {}) {
  return new fields.SchemaField({
    current: new fields.NumberField({ required: true, integer: true, initial: current }),
    min: new fields.NumberField({ required: true, integer: true, initial: min }),
    max: new fields.NumberField({ required: true, integer: true, initial: max })
  });
}

export class AxiomTrackersModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      momentum: trackerField({ current: 0, min: -5, max: 5 }),
      fate: trackerField({ current: 3, min: 0, max: 3 }),
      actionPoints: trackerField({ current: 3, min: 0, max: 3 })
    };
  }
}
