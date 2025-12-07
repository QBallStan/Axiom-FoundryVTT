// systems/axiom/scripts/rolls/item-roll.mjs

import AxiomRoll from "./axiom-roll.mjs";

/**
 * Perform an item roll.
 *
 * Items always use: attribute + skill + modifier
 * (attributeValue and skillValue must be provided by the caller)
 *
 * Future-proof: items can later override includeFateDie, damage rolls,
 * multiple steps (attack + damage), ammo checks, etc.
 */
export async function rollItemCheck({
  attributeValue,
  skillValue,
  modifier = 0,
  data = {},
}) {
  const attr = Number(attributeValue) || 0;
  const skill = Number(skillValue) || 0;
  const mod = Number(modifier) || 0;

  // Total dice
  const totalDice = Math.max(0, attr + skill + mod);

  // One fate die, rest trait dice
  const traitDice = Math.max(0, totalDice - 1);
  const includeFateDie = totalDice > 0;

  const roll = AxiomRoll.create({
    traitDice,
    includeFateDie,
    data,
  });

  await roll.evaluate();
  return roll;
}
