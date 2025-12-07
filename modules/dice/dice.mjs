// systems/axiom/scripts/dice.mjs

/**
 * Trait Die (standard d8)
 * 7–8 → +1 hit
 * 1–6 → 0
 */
export function evalTraitDie(face) {
  const value = Number(face) || 0;
  const hit = value >= 7 ? 1 : 0;
  return { value, hit };
}

/**
 * Tally a set of trait dice.
 * Input: array of raw faces, e.g. [2, 8, 7, 1, 6]
 * Output: total hits.
 */
export function tallyTraitDice(results = []) {
  let hits = 0;

  for (const face of results) {
    const { hit } = evalTraitDie(face);
    hits += hit;
  }

  return { hits };
}

/**
 * Fate Die (special d8)
 *
 * 1  → Double Miss   (hitValue = -2)
 * 2–4 → Miss        (hitValue = -1)
 * 5  → Flaw         (hitValue = 0, flaw = true)
 * 6  → Focus        (hitValue = 0, focus = 1)
 * 7  → Hit          (hitValue = +1)
 * 8  → Double Hit   (hitValue = +2)
 */
export function evalFateDie(face) {
  const value = Number(face) || 0;

  let hitValue = 0;
  let focus = 0;
  let flaw = false;

  if (value === 1) {
    hitValue = -2;
  } else if (value >= 2 && value <= 4) {
    hitValue = -1;
  } else if (value === 5) {
    flaw = true;
  } else if (value === 6) {
    focus = 1;
  } else if (value === 7) {
    hitValue = 1;
  } else if (value === 8) {
    hitValue = 2;
  }

  return { value, hitValue, focus, flaw };
}

/**
 * Apply difficulty to a net result.
 */
export function applyDifficulty(net, difficulty = 0) {
  const base = Number(net) || 0;
  const diff = Number(difficulty) || 0;
  return base + diff;
}

/**
 * Map a final net value to a success tier.
 * 0 or less → failure
 * 1        → success
 * 2        → strong-success
 * 3+       → exceptional-success
 */
export function getSuccessTier(finalNet, fateDieResult) {
  const n = Number(finalNet) || 0;

  // Check for failure + flaw
  if (n <= 0 && fateDieResult === "flaw") {
    return "Major failure";
  }

  // Standard failure
  if (n <= 0) return "Failure";

  // Success tiers
  if (n === 1) return "Success";
  if (n === 2) return "Strong success";
  return "Exceptional success";
}

/**
 * Convenience helper to go from raw dice to full Axiom result.
 *
 * traitResults: array of numbers (all trait dice)
 * fateFace: single number (fate die face)
 * difficulty: numeric difficulty modifier
 */
export function tallyAxiomPool(
  traitResults = [],
  fateFace = null,
  difficulty = 0
) {
  const trait = tallyTraitDice(traitResults);
  const fate = evalFateDie(fateFace);

  const rawNet = trait.hits + fate.hitValue;
  const finalNet = applyDifficulty(rawNet, difficulty);
  const fateDieResult = fate.flaw ? "flaw" : null;
  const tier = getSuccessTier(finalNet, fateDieResult);

  return {
    traitHits: trait.hits,
    fate,
    rawNet,
    finalNet,
    tier,
  };
}

export class AxiomDieTrait extends foundry.dice.terms.Die {
  constructor(termData) {
    termData.faces = 8;
    super(termData);
  }

  static DENOMINATION = "t";

  getResultLabel(result) {
    const face = result.result;
    return `<img src="systems/axiom/assets/dice/trait-${face}.png" />`;
  }
}

export class AxiomDieFate extends foundry.dice.terms.Die {
  constructor(termData) {
    termData.faces = 8;
    super(termData);
  }

  static DENOMINATION = "a";

  getResultLabel(result) {
    const face = result.result;
    return `<img src="systems/axiom/assets/dice/fate-${face}.png" />`;
  }
}

import { DiceSystem } from "../../../../modules/dice-so-nice/api.js";

Hooks.on("diceSoNiceReady", (dice3d) => {
  const axiomSystem = new DiceSystem(
    "axiom", // id used internally
    "Axiom//Core", // name shown in UI
    "preferred", // "preferred" = default for users unless changed
    "Axiom Systems" // group label in DsN system list
  );

  dice3d.addSystem(axiomSystem);

  // 2. DEFAULT COLORSETS (user can override)
  dice3d.addColorset(
    {
      name: "axiom-default",
      description: "Axiom Default",
      category: "Axiom",
      material: "metal",
      foreground: "#ffffff", // label color
      background: "#cc4128", // dice color
      outline: "#cc4128",
      edge: "#cc4128",
    },
    "preferred"
  );

  dice3d.addColorset(
    {
      name: "axiom-trait-default",
      description: "Axiom Trait Default",
      category: "Axiom",
      material: "metal",
      foreground: "#ffffff", // label color
      background: "#cc4128", // dice color
      outline: "#cc4128",
      edge: "#cc4128",
    },
    "default"
  ); // << THIS is also required for defaults

  dice3d.addColorset(
    {
      name: "axiom-fate-default",
      description: "Axiom Fate Default",
      category: "Axiom",
      material: "metal",
      foreground: "#ffffff",
      background: "#00bfff",
      outline: "#00bfff",
      edge: "#00bfff",
    },
    "default"
  ); // << SAME HERE

  // 3. TRAIT DIE
  dice3d.addDicePreset(
    {
      type: "dt",
      system: "axiom",
      labels: [
        "systems/axiom/assets/dice/trait-1.png",
        "systems/axiom/assets/dice/trait-2.png",
        "systems/axiom/assets/dice/trait-3.png",
        "systems/axiom/assets/dice/trait-4.png",
        "systems/axiom/assets/dice/trait-5.png",
        "systems/axiom/assets/dice/trait-6.png",
        "systems/axiom/assets/dice/trait-7.png",
        "systems/axiom/assets/dice/trait-8.png",
      ],
      bumpMaps: [
        "systems/axiom/assets/dice/trait-1-bump.png",
        "systems/axiom/assets/dice/trait-2-bump.png",
        "systems/axiom/assets/dice/trait-3-bump.png",
        "systems/axiom/assets/dice/trait-4-bump.png",
        "systems/axiom/assets/dice/trait-5-bump.png",
        "systems/axiom/assets/dice/trait-6-bump.png",
        "systems/axiom/assets/dice/trait-7-bump.png",
        "systems/axiom/assets/dice/trait-8-bump.png",
      ],
      labelTint: true,
      colorset: "axiom-trait-default",
    },
    "d8"
  );

  // 4. FATE DIE
  dice3d.addDicePreset(
    {
      type: "da",
      system: "axiom",
      labels: [
        "systems/axiom/assets/dice/fate-1.png",
        "systems/axiom/assets/dice/fate-2.png",
        "systems/axiom/assets/dice/fate-3.png",
        "systems/axiom/assets/dice/fate-4.png",
        "systems/axiom/assets/dice/fate-5.png",
        "systems/axiom/assets/dice/fate-6.png",
        "systems/axiom/assets/dice/fate-7.png",
        "systems/axiom/assets/dice/fate-8.png",
      ],
      bumpMaps: [
        "systems/axiom/assets/dice/fate-1-bump.png",
        "systems/axiom/assets/dice/fate-2-bump.png",
        "systems/axiom/assets/dice/fate-3-bump.png",
        "systems/axiom/assets/dice/fate-4-bump.png",
        "systems/axiom/assets/dice/fate-5-bump.png",
        "systems/axiom/assets/dice/fate-6-bump.png",
        "systems/axiom/assets/dice/fate-7-bump.png",
        "systems/axiom/assets/dice/fate-8-bump.png",
      ],
      labelTint: true,
      colorset: "axiom-fate-default",
    },
    "d8"
  );
});
