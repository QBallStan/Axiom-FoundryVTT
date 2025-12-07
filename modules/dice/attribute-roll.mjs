import AxiomRoll from "./axiom-roll.mjs";

export async function rollAttributeTest({
  primaryValue,
  secondaryValue,
  modifier = 0,
  difficulty = 0,
  data = {},
}) {
  const a = Number(primaryValue) || 0;
  const b = Number(secondaryValue) || 0;

  // Apply full modifier to base dice
  let totalDice = a + b + (Number(modifier) || 0);
  totalDice = Math.max(0, totalDice);

  // Trait dice = total - 1 Fate die
  const traitDice = Math.max(0, totalDice - 1);

  const roll = AxiomRoll.create({
    traitDice,
    includeFateDie: true,
    data,
  });

  await roll.evaluate();
  return roll;
}
