// systems/axiom/scripts/rolls/axiom-roll.mjs

export default class AxiomRoll {

  /**
   * Build a valid Foundry roll using standard dice.
   * Does NOT extend Roll. Matches Crucible’s pattern exactly.
   */
  static create({ traitDice = 0, includeFateDie = true, data = {} } = {}) {

    const parts = [];

    if (traitDice > 0) {
      parts.push(`${traitDice}dt`);
    }

    if (includeFateDie) {
      if (parts.length > 0) parts.push("+");
      parts.push("1da");
    }

    // Fallback: always roll at least 1d8
    const formula = parts.length ? parts.join(" ") : "1dt";

    // Crucible-style: let Foundry build the actual roll instance
    return foundry.dice.Roll.create(formula, data);
  }
}
