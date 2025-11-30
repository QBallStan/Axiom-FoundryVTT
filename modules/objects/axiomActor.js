export default class axiomActor extends Actor {
  /* -------------------------------------------- */
  /*  Base Data Preparation                       */
  /* -------------------------------------------- */

  prepareData() {
    super.prepareData();
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    const actorData = this.system;

    // Main character-type switch if needed later
    this._preparePlayerCharacterData(actorData);
  }

  /* -------------------------------------------- */

  _preparePlayerCharacterData(actorData) {
    // Base character values (your future derived stats)
    this._setCharacterValues(actorData);

    // Armor aggregation from equipped items
    this._applyEquippedArmor(actorData);
  }

  /* -------------------------------------------- */
  /*  Derived Stats: Placeholder                  */
  /* -------------------------------------------- */

  async _setCharacterValues(data) {
    // Insert calculations for derived stats here later (movement, toughness, etc.)

    const attrs = data.attributes;
    const trackers = data.trackers;

    // ATTRIBUTE SHORTCUTS
    const STR = Number(attrs.strength.value);
    const AGI = Number(attrs.agility.value);
    const FORT = Number(attrs.fortitude.value);
    const LOG = Number(attrs.logic.value);
    const RES = Number(attrs.resolve.value);
    const CHA = Number(attrs.charisma.value);
    const INS = Number(attrs.instinct.value);

    /* -------------------------------------------- */
    /* HEALTH (fixed 3, allow negative, start full) */
    /* -------------------------------------------- */
    trackers.health.max = 3;

    if (trackers.health.value == null) {
      // Only for NEW actors
      trackers.health.value = trackers.health.max;
    } else {
      // Clamp only top, never raise up
      trackers.health.value = Math.min(
        trackers.health.value,
        trackers.health.max
      );
    }

    /* -------------------------------------------- */
    /* STAMINA (fixed 3, 0..max, start full) */
    /* -------------------------------------------- */
    trackers.stamina.max = 3;

    if (trackers.stamina.value == null) {
      trackers.stamina.value = trackers.stamina.max;
    } else {
      trackers.stamina.value = Math.max(
        0,
        Math.min(trackers.stamina.value, trackers.stamina.max)
      );
    }

    /* TOUGHNESS = 2 + floor(FORT / 2) */
    const toughness = 2 + Math.floor(FORT / 2);
    trackers.toughness.base = toughness;
    trackers.toughness.value = toughness;
    trackers.toughness.max = toughness;

    /* MOVEMENT = 5 + ceil(AGI / 2) */
    const movement = 5 + Math.ceil(AGI / 2);
    trackers.movement.base = movement;
    trackers.movement.value = movement;
    trackers.movement.max = movement;

    /* CORRUPTION THRESHOLD = 4 + RESOLVE */
    const corruption = 4 + RES;
    trackers.corruption.base = corruption;
    trackers.corruption.max = corruption;
    // keep current value, but clamp
    trackers.corruption.value = Math.min(trackers.corruption.value, corruption);

    /* FOCUS */
    trackers.focus.max = 3;

    /* If value is null/undefined, initialize at max */
    if (trackers.focus.value == null) {
      trackers.focus.value = trackers.focus.max;
    }

    /* Clamp between 0 and max */
    trackers.focus.value = Math.max(
      0,
      Math.min(trackers.focus.value, trackers.focus.max)
    );

    /* ACTION POINTS */
    trackers.actionPoints.max = 3; // or whatever your base max calculation is

    /* If value is null/undefined, initialize to full */
    if (trackers.actionPoints.value == null) {
      trackers.actionPoints.value = trackers.actionPoints.max;
    }

    /* Clamp between 0 and max */
    trackers.actionPoints.value = Math.max(
      0,
      Math.min(trackers.actionPoints.value, trackers.actionPoints.max)
    );
  }

  /* -------------------------------------------- */
  /*  ARMOR CALCULATION                           */
  /* -------------------------------------------- */

  /**
   * Aggregate armor from equipped armor items.
   * Writes final values to actor.system.armor.{head,chest,arms,legs}
   */
  _applyEquippedArmor(actorData) {
    const equippedArmor = this.items.filter(
      (i) => i.type === "armor" && i.system.isEquipped
    );

    const slots = actorData.trackers.armor;

    slots.head = 0;
    slots.chest = 0;
    slots.arms = 0;
    slots.legs = 0;

    for (const item of equippedArmor) {
      slots.head += Number(item.system.head ?? 0);
      slots.chest += Number(item.system.chest ?? 0);
      slots.arms += Number(item.system.arms ?? 0);
      slots.legs += Number(item.system.legs ?? 0);
    }
  }

  /* -------------------------------------------- */
  /*  UTILITY FUNCTIONS                           */
  /* -------------------------------------------- */

  setNote(note) {
    this.update({ "system.note": note });
  }

  /* -------------------------------------------- */

  addLogEntry(entry) {
    const log = this.system.log;
    log.push(entry);
    this.update({ "system.log": log });
  }
}
