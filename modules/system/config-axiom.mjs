const STATUS_ICON_PATH = "icons/svg";
const AXIOM_STATUS_ICON_PATH = "systems/axiom/assets/icons/status";

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
    numbered: true
  },
  chilled: {
    id: "chilled",
    label: "AXIOM.Actor.Statuses.Chilled",
    description: "AXIOM.Actor.StatusDescriptions.Chilled",
    img: `${STATUS_ICON_PATH}/frozen.svg`,
    icon: "fa-solid fa-snowflake",
    category: "control",
    max: 4,
    numbered: true
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
    numbered: true
  },
  fatigue: {
    id: "fatigue",
    label: "AXIOM.Actor.Statuses.Fatigue",
    description: "AXIOM.Actor.StatusDescriptions.Fatigue",
    img: `${STATUS_ICON_PATH}/unconscious.svg`,
    icon: "fa-solid fa-bed",
    category: "control",
    max: 5,
    numbered: true
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
  fear: {
    id: "fear",
    label: "AXIOM.Actor.Statuses.Fear",
    description: "AXIOM.Actor.StatusDescriptions.Fear",
    img: `${STATUS_ICON_PATH}/terror.svg`,
    icon: "fa-solid fa-skull",
    category: "other",
    max: 1,
    numbered: false
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

function toStatusEffect(status) {
  const effect = {
    id: status.id,
    name: status.label,
    description: status.description,
    img: status.img,
    statuses: [status.id],
    flags: {
      axiom: {
        status: true,
        id: status.id,
        category: status.category,
        value: status.numbered ? 1 : null,
        max: status.max,
        numbered: status.numbered
      }
    }
  };

  if (status.overlay) effect.flags.core = { overlay: true };
  return effect;
}

export const AXIOM = {
  initiative: {
    formula: "1d10 + @subAttributes.initiative",
    decimals: 0
  },

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
    ranged: "AXIOM.Weapon.Categories.Ranged"
  },

  damageDelivery: {
    kinetic: "AXIOM.Weapon.Delivery.Kinetic",
    direct: "AXIOM.Weapon.Delivery.Direct"
  },

  gearStates: {
    equipped: "AXIOM.Item.State.Equipped",
    carried: "AXIOM.Item.State.Carried",
    stored: "AXIOM.Item.State.Stored"
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
