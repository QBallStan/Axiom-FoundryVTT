export default class InitiativeRoll extends Roll {
  /**
   * @param {number} instinct      Instinct attribute value
   * @param {object} [data={}]     Additional roll data (actor id, etc.)
   */
  constructor(instinct, data = {}) {
    const inst = Number(instinct) || 0;
    const formula = `1d8 + ${inst}`;
    super(formula, data);
    this.instinct = inst;
  }

  /**
   * Convenience: evaluate synchronously and return this roll.
   */
  evaluateSync(options = {}) {
    return super.evaluateSync(options);
  }
}

/**
 * Quick helper for rolling initiative for an actor.
 *
 * @param {number} instinct
 * @param {object} [data={}]
 * @returns {InitiativeRoll}
 */
export function rollInitiative(instinct, data = {}) {
  const roll = new InitiativeRoll(instinct, data);
  return roll.evaluateSync();
}
