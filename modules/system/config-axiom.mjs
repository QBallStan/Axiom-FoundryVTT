const STATUS_ICON_PATH = "icons/svg";
const AXIOM_STATUS_ICON_PATH = "systems/axiom/assets/icons/status";


const ITEM_TECH_LEVELS = {
  0: { name: "AXIOM.Item.TechLevel.Names.0", description: "AXIOM.Item.TechLevel.Descriptions.0" },
  1: { name: "AXIOM.Item.TechLevel.Names.1", description: "AXIOM.Item.TechLevel.Descriptions.1" },
  2: { name: "AXIOM.Item.TechLevel.Names.2", description: "AXIOM.Item.TechLevel.Descriptions.2" },
  3: { name: "AXIOM.Item.TechLevel.Names.3", description: "AXIOM.Item.TechLevel.Descriptions.3" },
  4: { name: "AXIOM.Item.TechLevel.Names.4", description: "AXIOM.Item.TechLevel.Descriptions.4" },
  5: { name: "AXIOM.Item.TechLevel.Names.5", description: "AXIOM.Item.TechLevel.Descriptions.5" },
  6: { name: "AXIOM.Item.TechLevel.Names.6", description: "AXIOM.Item.TechLevel.Descriptions.6" },
  7: { name: "AXIOM.Item.TechLevel.Names.7", description: "AXIOM.Item.TechLevel.Descriptions.7" },
  8: { name: "AXIOM.Item.TechLevel.Names.8", description: "AXIOM.Item.TechLevel.Descriptions.8" },
  9: { name: "AXIOM.Item.TechLevel.Names.9", description: "AXIOM.Item.TechLevel.Descriptions.9" },
  10: { name: "AXIOM.Item.TechLevel.Names.10", description: "AXIOM.Item.TechLevel.Descriptions.10" },
  11: { name: "AXIOM.Item.TechLevel.Names.11", description: "AXIOM.Item.TechLevel.Descriptions.11" },
  12: { name: "AXIOM.Item.TechLevel.Names.12", description: "AXIOM.Item.TechLevel.Descriptions.12" }
};

const ATTRIBUTE_CHECK_PRESETS = {
  dodge: {
    label: "AXIOM.Actor.Skills.Presets.Dodge",
    attributeOne: "agility",
    attributeTwo: "instinct"
  },
  perception: {
    label: "AXIOM.Actor.Skills.Presets.Perception",
    attributeOne: "resolve",
    attributeTwo: "instinct"
  },
  insight: {
    label: "AXIOM.Actor.Skills.Presets.Insight",
    attributeOne: "logic",
    attributeTwo: "instinct"
  },
  composure: {
    label: "AXIOM.Actor.Skills.Presets.Composure",
    attributeOne: "charisma",
    attributeTwo: "resolve"
  },
  vigor: {
    label: "AXIOM.Actor.Skills.Presets.Vigor",
    attributeOne: "fortitude",
    attributeTwo: "resolve"
  },
  willpower: {
    label: "AXIOM.Actor.Skills.Presets.Willpower",
    attributeOne: "resolve",
    attributeTwo: "instinct"
  },
  grip: {
    label: "AXIOM.Actor.Skills.Presets.Grip",
    attributeOne: "strength",
    attributeTwo: "resolve"
  },
  memoryAcademic: {
    label: "AXIOM.Actor.Skills.Presets.MemoryAcademic",
    attributeOne: "logic",
    attributeTwo: "resolve"
  },
  memoryStreetwise: {
    label: "AXIOM.Actor.Skills.Presets.MemoryStreetwise",
    attributeOne: "instinct",
    attributeTwo: "resolve"
  }
};

const STATUSES = {
  burning: {
    id: "burning",
    label: "AXIOM.Actor.Statuses.Burning",
    description: "AXIOM.Actor.StatusDescriptions.Burning",
    img: `${STATUS_ICON_PATH}/fire.svg`,
    icon: "fa-solid fa-fire",
    category: "damage",
    max: 10,
    numbered: true
  },
  bleeding: {
    id: "bleeding",
    label: "AXIOM.Actor.Statuses.Bleeding",
    description: "AXIOM.Actor.StatusDescriptions.Bleeding",
    img: `${STATUS_ICON_PATH}/blood.svg`,
    icon: "fa-solid fa-droplet",
    category: "damage",
    max: 3,
    numbered: true
  },
  stunned: {
    id: "stunned",
    label: "AXIOM.Actor.Statuses.Stunned",
    description: "AXIOM.Actor.StatusDescriptions.Stunned",
    img: `${STATUS_ICON_PATH}/stoned.svg`,
    icon: "fa-solid fa-star",
    category: "control",
    max: 3,
    numbered: true,
    changes: [
      { key: "system.trackers.actionPoints.max", type: "subtract", value: 1, perStack: true },
      { key: "system.subAttributes.movement", type: "multiply", value: 0.5 }
    ]
  },
  chilled: {
    id: "chilled",
    label: "AXIOM.Actor.Statuses.Chilled",
    description: "AXIOM.Actor.StatusDescriptions.Chilled",
    img: `${STATUS_ICON_PATH}/frozen.svg`,
    icon: "fa-solid fa-snowflake",
    category: "control",
    max: 4,
    numbered: true,
    rollModifierPerStack: -5,
    changes: [
      { key: "flags.axiom.rollModifiers.all", type: "add", value: -5, perStack: true },
      { key: "system.subAttributes.movement", type: "subtract", value: 1, perStack: true }
    ]
  },
  corroding: {
    id: "corroding",
    label: "AXIOM.Actor.Statuses.Corroding",
    description: "AXIOM.Actor.StatusDescriptions.Corroding",
    img: `${STATUS_ICON_PATH}/acid.svg`,
    icon: "fa-solid fa-flask",
    category: "damage",
    max: 5,
    numbered: true
  },
  entangled: {
    id: "entangled",
    label: "AXIOM.Actor.Statuses.Entangled",
    description: "AXIOM.Actor.StatusDescriptions.Entangled",
    img: `${STATUS_ICON_PATH}/net.svg`,
    icon: "fa-solid fa-link",
    category: "control",
    max: null,
    numbered: true,
    rollModifierPerStack: -5,
    changes: [
      { key: "flags.axiom.rollModifiers.all", type: "add", value: -5, perStack: true },
      { key: "system.subAttributes.movement", type: "override", value: 0 }
    ]
  },
  fatigue: {
    id: "fatigue",
    label: "AXIOM.Actor.Statuses.Fatigue",
    description: "AXIOM.Actor.StatusDescriptions.Fatigue",
    img: `${AXIOM_STATUS_ICON_PATH}/fatigue.svg`,
    icon: "fa-solid fa-bed",
    category: "control",
    max: 5,
    numbered: true,
    rollModifierPerStack: -5,
    changes: [
      { key: "flags.axiom.rollModifiers.all", type: "add", value: -5, perStack: true }
    ]
  },
  sprinting: {
    id: "sprinting",
    label: "AXIOM.Actor.Statuses.Sprinting",
    description: "AXIOM.Actor.StatusDescriptions.Sprinting",
    img: `${AXIOM_STATUS_ICON_PATH}/sprint.svg`,
    icon: "fa-solid fa-person-running",
    category: "movement",
    max: 3,
    numbered: true,
    rollModifierPerStack: -5,
    changes: [
      { key: "flags.axiom.rollModifiers.all", type: "add", value: -5, perStack: true }
    ]
  },
  prone: {
    id: "prone",
    label: "AXIOM.Actor.Statuses.Prone",
    description: "AXIOM.Actor.StatusDescriptions.Prone",
    img: `${STATUS_ICON_PATH}/falling.svg`,
    icon: "fa-solid fa-person-falling",
    category: "position",
    max: 1,
    numbered: false
  },
  distracted: {
    id: "distracted",
    label: "AXIOM.Actor.Statuses.Distracted",
    description: "AXIOM.Actor.StatusDescriptions.Distracted",
    img: `${AXIOM_STATUS_ICON_PATH}/distracted.svg`,
    icon: "fa-solid fa-circle-exclamation",
    category: "control",
    max: 4,
    numbered: true,
    rollModifierPerStack: -5,
    changes: [
      { key: "flags.axiom.rollModifiers.all", type: "add", value: -5, perStack: true }
    ]
  },
  fear: {
    id: "fear",
    label: "AXIOM.Actor.Statuses.Fear",
    description: "AXIOM.Actor.StatusDescriptions.Fear",
    img: `${STATUS_ICON_PATH}/terror.svg`,
    icon: "fa-solid fa-skull",
    category: "other",
    max: 1,
    numbered: false,
    hiddenOnSheet: true
  },
  lightCover: {
    id: "lightCover",
    label: "AXIOM.Actor.Statuses.LightCover",
    description: "AXIOM.Actor.StatusDescriptions.LightCover",
    img: `${AXIOM_STATUS_ICON_PATH}/cover-light.png`,
    icon: "fa-solid fa-shield-halved",
    category: "cover",
    group: "cover",
    max: 1,
    numbered: false,
    hiddenOnSheet: true
  },
  mediumCover: {
    id: "mediumCover",
    label: "AXIOM.Actor.Statuses.MediumCover",
    description: "AXIOM.Actor.StatusDescriptions.MediumCover",
    img: `${AXIOM_STATUS_ICON_PATH}/cover-medium.png`,
    icon: "fa-solid fa-shield-halved",
    category: "cover",
    group: "cover",
    max: 1,
    numbered: false,
    hiddenOnSheet: true
  },
  heavyCover: {
    id: "heavyCover",
    label: "AXIOM.Actor.Statuses.HeavyCover",
    description: "AXIOM.Actor.StatusDescriptions.HeavyCover",
    img: `${AXIOM_STATUS_ICON_PATH}/cover-heavy.png`,
    icon: "fa-solid fa-shield-halved",
    category: "cover",
    group: "cover",
    max: 1,
    numbered: false,
    hiddenOnSheet: true
  },
  incapacitated: {
    id: "incapacitated",
    label: "AXIOM.Actor.Statuses.Incapacitated",
    description: "AXIOM.Actor.StatusDescriptions.Incapacitated",
    img: `${STATUS_ICON_PATH}/unconscious.svg`,
    icon: "fa-solid fa-person-falling-burst",
    category: "other",
    max: 1,
    numbered: false,
    overlay: true,
    hiddenOnSheet: true
  },
  dead: {
    id: "dead",
    label: "AXIOM.Actor.Statuses.Dead",
    description: "AXIOM.Actor.StatusDescriptions.Dead",
    img: `${STATUS_ICON_PATH}/skull.svg`,
    icon: "fa-solid fa-skull-crossbones",
    category: "other",
    max: 1,
    numbered: false,
    overlay: true,
    hiddenOnSheet: true
  }
};

function toStatusEffect(status, value = 1) {
  const effect = {
    id: status.id,
    name: status.label,
    description: status.description,
    img: status.img,
    statuses: [status.id],
    changes: getStatusEffectChanges(status, value),
    flags: {
      axiom: {
        status: true,
        id: status.id,
        category: status.category,
        value: status.numbered ? value : null,
        max: status.max,
        numbered: status.numbered
      }
    }
  };

  if (status.overlay) effect.flags.core = { overlay: true };
  return effect;
}

export function getStatusEffectChanges(status, value = 1) {
  const stacks = Math.max(1, Number(value) || 1);
  return (status.changes ?? []).map(change => {
    const type = String(change.type ?? "add").toLowerCase();
    const baseValue = Number(change.value ?? 0);
    const scaledValue = change.perStack ? baseValue * stacks : baseValue;
    return {
      key: change.key,
      type,
      value: String(scaledValue),
      priority: Number(change.priority ?? getStatusEffectChangePriority(type))
    };
  });
}

function getStatusEffectChangePriority(type) {
  switch (String(type ?? "add").toLowerCase()) {
    case "multiply": return 10;
    case "add":
    case "subtract": return 20;
    case "downgrade": return 30;
    case "upgrade": return 40;
    case "override": return 50;
    default: return 20;
  }
}

export const AXIOM = {
  initiative: {
    formula: "1d10 + @subAttributes.initiative",
    decimals: 0
  },

  itemTechLevels: ITEM_TECH_LEVELS,

  attributes: {
    strength: "AXIOM.Attributes.Strength",
    agility: "AXIOM.Attributes.Agility",
    fortitude: "AXIOM.Attributes.Fortitude",
    logic: "AXIOM.Attributes.Logic",
    resolve: "AXIOM.Attributes.Resolve",
    charisma: "AXIOM.Attributes.Charisma",
    instinct: "AXIOM.Attributes.Instinct",
    power: "AXIOM.Attributes.Power"
  },


  attributeCheckPresets: ATTRIBUTE_CHECK_PRESETS,

  skillCategories: {
    core: "AXIOM.Skill.Categories.Core",
    expertise: "AXIOM.Skill.Categories.Expertise"
  },

  weaponCategories: {
    melee: "AXIOM.Weapon.Categories.Melee",
    ranged: "AXIOM.Weapon.Categories.Ranged",
    mixed: "AXIOM.Weapon.Categories.Mixed"
  },

  elementalDamage: {
    none: "AXIOM.Weapon.Elemental.None",
    fire: "AXIOM.Weapon.Elemental.Fire",
    cold: "AXIOM.Weapon.Elemental.Cold",
    electric: "AXIOM.Weapon.Elemental.Electric",
    acid: "AXIOM.Weapon.Elemental.Acid",
    corruption: "AXIOM.Weapon.Elemental.Corruption",
    radiant: "AXIOM.Weapon.Elemental.Radiant",
    necrotic: "AXIOM.Weapon.Elemental.Necrotic",
    psychic: "AXIOM.Weapon.Elemental.Psychic"
  },

  weaponReloadCosts: {
    0: "AXIOM.Weapon.ReloadCost.Free",
    1: "AXIOM.Weapon.ReloadCost.OneAP",
    2: "AXIOM.Weapon.ReloadCost.TwoAP",
    3: "AXIOM.Weapon.ReloadCost.ThreeAP"
  },

  damageDelivery: {
    kinetic: "AXIOM.Weapon.Delivery.Kinetic",
    direct: "AXIOM.Weapon.Delivery.Direct"
  },

  coverTypes: {
    light: "AXIOM.Shield.Cover.Light",
    medium: "AXIOM.Shield.Cover.Medium",
    heavy: "AXIOM.Shield.Cover.Heavy"
  },

  gearStates: {
    equipped: "AXIOM.Item.State.Equipped",
    carried: "AXIOM.Item.State.Carried",
    stored: "AXIOM.Item.State.Stored"
  },

  handGearStates: {
    mainHand: "AXIOM.Item.State.MainHand",
    offHand: "AXIOM.Item.State.OffHand",
    bothHands: "AXIOM.Item.State.BothHands",
    carried: "AXIOM.Item.State.Carried",
    stored: "AXIOM.Item.State.Stored"
  },

  weaponHands: {
    one: "AXIOM.Weapon.Hands.One",
    two: "AXIOM.Weapon.Hands.Two",
    versatile: "AXIOM.Weapon.Hands.Versatile"
  },

  weaponGuard: {
    full: "AXIOM.Weapon.Guard.Full",
    limited: "AXIOM.Weapon.Guard.Limited"
  },

  weaponReloadMethods: {
    none: "AXIOM.Weapon.ReloadMethod.None",
    thrown: "AXIOM.Weapon.ReloadMethod.Thrown",
    drawn: "AXIOM.Weapon.ReloadMethod.Drawn",
    single: "AXIOM.Weapon.ReloadMethod.Single"
  },

  traitCategories: {
    quality: "AXIOM.Trait.Categories.Quality",
    flaw: "AXIOM.Trait.Categories.Flaw"
  },

  booleanOptions: {
    true: "AXIOM.Common.Yes",
    false: "AXIOM.Common.No"
  },

  statuses: STATUSES,
  statusEffects: Object.values(STATUSES).map(toStatusEffect),
  statusEffectMap: Object.fromEntries(Object.values(STATUSES).map(status => [status.id, toStatusEffect(status)]))
};
