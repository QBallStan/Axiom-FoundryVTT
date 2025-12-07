// modules/systems/combat.mjs

import { AXIOM } from "../config.mjs";

export function rollHitLocation() {
  const table = AXIOM.hitLocations.d8;
  const roll = new Roll("1d8").evaluateSync().total;
  return table.find(e => e.range.includes(roll));
}

/* -------------------------------------------- */
/*  Custom Combatant for Axiom Initiative       */
/* -------------------------------------------- */

class AxiomCombatant extends CONFIG.Combatant.documentClass {

  /**
   * Build and return the initiative Roll (unevaluated).
   * Foundry will evaluate it and post it normally.
   */
  getInitiativeRoll(_formula) {
    const actor = this.actor;
    if (!actor) return null;

    const attrs = actor.system.attributes;

    const inst = Number(attrs.instinct?.value ?? 0);
    const agi  = Number(attrs.agility?.value ?? 0);
    const log  = Number(attrs.logic?.value ?? 0);

    const secondary = Math.max(agi, log);

    // DAMAGE PENALTIES
    const p = actor.system.penalty;
    const damagePenalty = (p?.health ?? 0) + (p?.stamina ?? 0);

    // Construct final initiative formula
    const formula = `1d8 + ${inst} + ${secondary} - ${damagePenalty}`;

    return new Roll(formula, { actorId: actor.id });
  }
}

/* -------------------------------------------- */
/*  Custom Combat Document                      */
/* -------------------------------------------- */

export default class AxiomCombat extends foundry.documents.Combat {

  /**
   * Foundry still requests a formula string, so give it something valid.
   * The Combatant override fully replaces this logic.
   */
  _getInitiativeFormula() {
    return "1d8";
  }

  /**
   * Sort combatants by initiative. Higher goes first,
   * ties broken by Instinct.
   */
  _sortCombatants(a, b) {
    const ai = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const bi = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    if (ai !== bi) return bi - ai;

    const aInst = a.actor?.system.attributes.instinct.value ?? 0;
    const bInst = b.actor?.system.attributes.instinct.value ?? 0;

    return bInst - aInst;
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

Hooks.once("init", () => {
  CONFIG.Combat.documentClass = AxiomCombat;
  CONFIG.Combatant.documentClass = AxiomCombatant;
});
