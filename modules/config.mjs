export const AXIOM = {};

// … your existing sections …

AXIOM.attributes = {
  strength: "Strength",
  agility: "Agility",
  fortitude: "Fortitude",
  logic: "Logic",
  resolve: "Resolve",
  charisma: "Charisma",
  instinct: "Instinct",
  power: "Power",
};

AXIOM.weaponCategories = {
  melee: "Melee",
  ranged: "Ranged",
};

AXIOM.damageClasses = {
  lethal: "Lethal",
  stun: "Stun",
};

AXIOM.damageTypes = {
  kinetic: "Kinetic",
  fire: "Fire",
  cold: "Cold",
  electric: "Electric",
  acid: "Acid",
  corruption: "Corruption",
  radiant: "Radiant",
  necrotic: "Necrotic",
  psychic: "Psychic",
};

AXIOM.difficulties = {
  easy:       { key: "easy",       label: "Easy",        value:  1 },
  average:    { key: "average",    label: "Average",     value:  0 },
  hard:       { key: "hard",       label: "Hard",        value: -1 },
  veryhard:   { key: "veryhard",   label: "Very Hard",   value: -2 },
  extreme:    { key: "extreme",    label: "Extreme",     value: -3 },
  impossible: { key: "impossible", label: "Impossible",  value: -4 },
};

AXIOM.hitLocations = {
  d8: [
    { range: [1],       location: "Left Leg",  armorRegion: "legs" },
    { range: [2],       location: "Right Leg", armorRegion: "legs" },
    { range: [3, 4, 5], location: "Torso",     armorRegion: "chest" },
    { range: [6],       location: "Left Arm",  armorRegion: "arms" },
    { range: [7],       location: "Right Arm", armorRegion: "arms" },
    { range: [8],       location: "Head",      armorRegion: "head" }
  ]
};

export function rollHitLocation() {
  const table = AXIOM.hitLocations.d8;
  const roll = new Roll("1d8").evaluateSync().total;
  return table.find(e => e.range.includes(roll));
}
