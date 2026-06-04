const fields = foundry.data.fields;

function trackerField({ current = 0, min = 0, max = 0 } = {}) {
  return new fields.SchemaField({
    current: new fields.NumberField({ required: true, integer: true, initial: current }),
    // Foundry's native token resource bars expect resource objects to expose a value/max pair.
    // Keep value mirrored to current so the sheet can use current while token bars can use value.
    value: new fields.NumberField({ required: true, integer: true, initial: current }),
    min: new fields.NumberField({ required: true, integer: true, initial: min }),
    max: new fields.NumberField({ required: true, integer: true, initial: max })
  });
}

export class AxiomTrackersModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      momentum: trackerField({ current: 0, min: 0, max: 3 }),
      fate: trackerField({ current: 3, min: 0, max: 3 }),
      actionPoints: trackerField({ current: 3, min: 0, max: 3 })
    };
  }
}

export class AxiomNpcTrackersModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      momentum: trackerField({ current: 0, min: 0, max: 1 }),
      fate: trackerField({ current: 0, min: 0, max: 0 }),
      actionPoints: trackerField({ current: 3, min: 0, max: 3 })
    };
  }
}
