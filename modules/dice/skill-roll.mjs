// systems/axiom/scripts/rolls/skill-roll.mjs

import AxiomRoll from "./axiom-roll.mjs";

/**
 * Build and evaluate a skill roll (Attribute + Skill + Modifier).
 *
 * @param {object} config
 * @param {number} config.attributeValue   Attribute value
 * @param {number} config.skillValue       Skill rank
 * @param {number} [config.modifier=0]     Extra dice to the pool
 * @param {number} [config.difficulty=0]   Difficulty applied after net hits (handled elsewhere)
 * @param {object} [config.data={}]        Extra metadata for chat
 *
 * @returns {Promise<Roll>}
 */
export async function rollSkillCheck({
  attributeValue,
  skillValue,
  modifier = 0,
  data = {},
}) {
  const attr = Number(attributeValue) || 0;
  const skill = Number(skillValue) || 0;
  const mod = Number(modifier) || 0;

  // Total dice = Attribute + Skill + Modifier
  const totalDice = Math.max(0, attr + skill + mod);

  // One die is Fate, the rest Trait
  const traitDice = Math.max(0, totalDice - 1);
  const includeFateDie = totalDice > 0;

  // Build Foundry Roll using AxiomRoll builder
  const roll = AxiomRoll.create({
    traitDice,
    includeFateDie,
    data,
  });

  // Evaluate asynchronously (Foundry requirement)
  await roll.evaluate();

  return roll;
}
