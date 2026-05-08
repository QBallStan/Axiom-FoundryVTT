const fields = foundry.data.fields;

function woundSlotField(healingMax = 0) {
  return new fields.SchemaField({
    taken: new fields.BooleanField({ required: true, initial: false }),
    healing: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    healingMax: new fields.NumberField({ required: true, integer: true, initial: healingMax, min: 0 }),
    injury: new fields.StringField({ required: false, blank: true, initial: "" })
  });
}

function woundTrackField({ max = 0, healingMax = 0, slots = 0 } = {}) {
  return new fields.SchemaField({
    current: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    max: new fields.NumberField({ required: true, integer: true, initial: max, min: 0 }),
    healingMax: new fields.NumberField({ required: true, integer: true, initial: healingMax, min: 0 }),
    slots: new fields.SchemaField({
      one: woundSlotField(slots >= 1 ? healingMax : 0),
      two: woundSlotField(slots >= 2 ? healingMax : 0),
      three: woundSlotField(slots >= 3 ? healingMax : 0),
      four: woundSlotField(slots >= 4 ? healingMax : 0),
      five: woundSlotField(slots >= 5 ? healingMax : 0)
    })
  });
}

export class AxiomWoundsModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      grazing: woundTrackField({ max: 3, healingMax: 1, slots: 3 }),
      minor: woundTrackField({ max: 2, healingMax: 2, slots: 2 }),
      major: woundTrackField({ max: 1, healingMax: 4, slots: 1 }),
      critical: woundTrackField({ max: 1, healingMax: 0, slots: 1 }),
      penalties: new fields.SchemaField({
        minor: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        major: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        total: new fields.NumberField({ required: true, integer: true, initial: 0 })
      })
    };
  }

  compute() {
    const slotKeys = ["one", "two", "three", "four", "five"];
    for (const [severity, track] of Object.entries(this)) {
      if (!track?.slots) continue;
      const max = Number(track.max ?? 0);
      track.current = slotKeys
        .slice(0, max)
        .map(key => track.slots[key])
        .filter(slot => slot?.taken).length;
    }

    const minorWounds = Number(this.minor?.current ?? 0);
    const majorWounds = Number(this.major?.current ?? 0);

    this.penalties.minor = minorWounds * -5;
    this.penalties.major = majorWounds * -10;
    this.penalties.total = this.penalties.minor + this.penalties.major;
  }
}
