import AxiomRoll from "./axiom-roll.mjs";

export async function rollAttributeTest({ primaryValue, secondaryValue, difficulty = 0, data = {} }) {

  const a = Number(primaryValue) || 0;
  const b = Number(secondaryValue) || 0;

  const totalDice = a + b;
  const traitDice = Math.max(0, totalDice - 1);

  const roll = AxiomRoll.create({
    traitDice,
    includeFateDie: true,
    data
  });

  await roll.evaluate();
  return roll;
}
