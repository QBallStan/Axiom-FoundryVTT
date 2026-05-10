/* -------------------------------------------- */
/*  Axiom//Core FoundryVTT System               */
/* -------------------------------------------- */

import { AXIOM } from "./modules/system/config-axiom.mjs";
import AxiomActor from "./modules/documents/actor.mjs";
import AxiomItem from "./modules/documents/item.mjs";
import AxiomProtagonistData from "./modules/model/actor/protagonist.mjs";
import AxiomNpcData from "./modules/model/actor/npc.mjs";
import AxiomSkillData from "./modules/model/item/skill.mjs";
import AxiomArmorData from "./modules/model/item/armor.mjs";
import AxiomShieldData from "./modules/model/item/shield.mjs";
import AxiomWeaponData from "./modules/model/item/weapon.mjs";
import AxiomMeleeWeaponData from "./modules/model/item/melee-weapon.mjs";
import AxiomRangedWeaponData from "./modules/model/item/ranged-weapon.mjs";
import AxiomAmmunitionData from "./modules/model/item/ammunition.mjs";
import AxiomEquipmentData from "./modules/model/item/equipment.mjs";
import AxiomTraitData from "./modules/model/item/trait.mjs";
import AxiomProtagonistSheet from "./modules/sheets/actor/protagonist-sheet.mjs";
import AxiomNpcSheet from "./modules/sheets/actor/npc-sheet.mjs";
import AxiomSkillSheet from "./modules/sheets/item/skill-sheet.mjs";
import AxiomArmorSheet from "./modules/sheets/item/armor-sheet.mjs";
import AxiomShieldSheet from "./modules/sheets/item/shield-sheet.mjs";
import AxiomWeaponSheet from "./modules/sheets/item/weapon-sheet.mjs";
import AxiomMeleeWeaponSheet from "./modules/sheets/item/melee-weapon-sheet.mjs";
import AxiomRangedWeaponSheet from "./modules/sheets/item/ranged-weapon-sheet.mjs";
import AxiomAmmunitionSheet from "./modules/sheets/item/ammunition-sheet.mjs";
import AxiomEquipmentSheet from "./modules/sheets/item/equipment-sheet.mjs";
import AxiomTraitSheet from "./modules/sheets/item/trait-sheet.mjs";
import AxiomRollWindow from "./modules/apps/roll-window.mjs";
import AxiomRoll from "./modules/system/rolls/axiom-roll.mjs";
import AxiomChatCard from "./modules/system/rolls/chat-card.mjs";
import { AxiomActiveEffect } from "./modules/model/active-effect/base.mjs";
import { configureAxiomStatusEffects, patchAxiomTokenStatusStackNumbers, registerAxiomStatusHooks } from "./modules/system/status/status-effects.mjs";
import { registerAxiomTokenHUD } from "./modules/system/status/token-hud.mjs";
import { registerAxiomSettings } from "./modules/system/settings.mjs";
import AxiomCombat from "./modules/system/combat.mjs";
import { registerAxiomCombatTracker } from "./modules/system/combat-tracker.mjs";
import { registerAxiomTokenOverlays } from "./modules/system/token-overlays.mjs";
import { registerAxiomDice } from "./modules/system/dice.mjs";

const { Actor, Item } = foundry.documents;
const { DocumentSheetConfig } = foundry.applications.apps;
const { loadTemplates } = foundry.applications.handlebars;

const LEGACY_ACTIVE_EFFECT_MODE_TYPES = Object.freeze({
  0: "custom",
  1: "multiply",
  2: "add",
  3: "downgrade",
  4: "upgrade",
  5: "override",
  custom: "custom",
  multiply: "multiply",
  add: "add",
  subtract: "subtract",
  downgrade: "downgrade",
  upgrade: "upgrade",
  override: "override"
});

const ACTIVE_EFFECT_TYPE_PRIORITIES = Object.freeze({
  custom: 0,
  multiply: 10,
  add: 20,
  subtract: 20,
  downgrade: 30,
  upgrade: 40,
  override: 50
});

function normalizeActiveEffectChangeType(value) {
  const key = String(value ?? "add").toLowerCase();
  return LEGACY_ACTIVE_EFFECT_MODE_TYPES[key] ?? "add";
}

function cloneActiveEffectChange(change) {
  return typeof change?.toObject === "function" ? change.toObject() : foundry.utils.deepClone(change ?? {});
}

async function migrateActiveEffectChangeTypes(document) {
  const effects = Array.from(document?.effects ?? []);
  for (const effect of effects) {
    const changes = Array.from(effect.changes ?? []);
    if (!changes.length) continue;

    let changed = false;
    const normalized = changes.map(change => {
      const data = cloneActiveEffectChange(change);
      const type = normalizeActiveEffectChangeType(data.type ?? data.mode);

      if (data.type !== type) {
        data.type = type;
        changed = true;
      }

      if ("mode" in data) {
        delete data.mode;
        changed = true;
      }

      if (!Number.isFinite(Number(data.priority))) {
        data.priority = ACTIVE_EFFECT_TYPE_PRIORITIES[type] ?? 20;
        changed = true;
      }

      return data;
    });

    if (changed) await effect.update({ changes: normalized });
  }
}

async function migrateWorldActiveEffectChangeTypes() {
  const documents = [...game.actors, ...game.items];
  for (const actor of game.actors) documents.push(...actor.items);
  for (const document of documents) await migrateActiveEffectChangeTypes(document);
}

Hooks.once("init", async function () {
  console.log("AXIOM//CORE | Initializing system");

  registerAxiomSettings();

  registerAxiomDice();

  game.axiom = {
    config: AXIOM,
    applications: { AxiomRollWindow },
    rolls: { AxiomRoll },
    chat: { AxiomChatCard },
    combat: AxiomCombat
  };
  CONFIG.AXIOM = AXIOM;
  configureAxiomStatusEffects(AXIOM);
  patchAxiomTokenStatusStackNumbers();

  CONFIG.Actor.documentClass = AxiomActor;
  CONFIG.ActiveEffect.documentClass = AxiomActiveEffect;
  CONFIG.ActiveEffect.phases ??= {
    initial: { priority: 0, label: "Initial" },
    final: { priority: 100, label: "Final" }
  };
  CONFIG.Item.documentClass = AxiomItem;
  CONFIG.Actor.dataModels.protagonist = AxiomProtagonistData;
  CONFIG.Actor.dataModels.npc = AxiomNpcData;
  CONFIG.Item.dataModels.skill = AxiomSkillData;
  CONFIG.Item.dataModels.armor = AxiomArmorData;
  CONFIG.Item.dataModels.shield = AxiomShieldData;
  CONFIG.Item.dataModels.weapon = AxiomWeaponData;
  CONFIG.Item.dataModels.meleeWeapon = AxiomMeleeWeaponData;
  CONFIG.Item.dataModels.rangedWeapon = AxiomRangedWeaponData;
  CONFIG.Item.dataModels.ammunition = AxiomAmmunitionData;
  CONFIG.Item.dataModels.equipment = AxiomEquipmentData;
  CONFIG.Item.dataModels.trait = AxiomTraitData;

  CONFIG.Combat.documentClass = AxiomCombat;
  CONFIG.Combat.initiative = foundry.utils.deepClone(AXIOM.initiative);

  DocumentSheetConfig.registerSheet(Actor, "axiom", AxiomProtagonistSheet, {
    types: ["protagonist"],
    makeDefault: true,
    label: "Axiom//Core Protagonist Sheet"
  });

  DocumentSheetConfig.registerSheet(Actor, "axiom", AxiomNpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "Axiom//Core NPC Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomSkillSheet, {
    types: ["skill"],
    makeDefault: true,
    label: "Axiom//Core Skill Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "Axiom//Core Armor Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomShieldSheet, {
    types: ["shield"],
    makeDefault: true,
    label: "Axiom//Core Shield Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "Axiom//Core Legacy Weapon Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomMeleeWeaponSheet, {
    types: ["meleeWeapon"],
    makeDefault: true,
    label: "Axiom//Core Melee Weapon Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomRangedWeaponSheet, {
    types: ["rangedWeapon"],
    makeDefault: true,
    label: "Axiom//Core Ranged Weapon Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomAmmunitionSheet, {
    types: ["ammunition"],
    makeDefault: true,
    label: "Axiom//Core Ammunition Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomEquipmentSheet, {
    types: ["equipment"],
    makeDefault: true,
    label: "Axiom//Core Equipment Sheet"
  });

  DocumentSheetConfig.registerSheet(Item, "axiom", AxiomTraitSheet, {
    types: ["trait"],
    makeDefault: true,
    label: "Axiom//Core Trait Sheet"
  });

  await preloadTemplates();
});

Hooks.once("setup", function () {
  console.log("AXIOM//CORE | Setup complete");
});

Hooks.once("ready", async function () {
  configureAxiomStatusEffects(AXIOM);
  patchAxiomTokenStatusStackNumbers();
  await migrateWorldActiveEffectChangeTypes();
  console.log("AXIOM//CORE | Ready");
});

Hooks.on("renderChatMessageHTML", AxiomChatCard.onRenderChatMessageHTML.bind(AxiomChatCard));
Hooks.on("renderActiveEffectConfig", (application, html) => {
  const element = html instanceof HTMLElement ? html : html?.[0] ?? html;
  const form = element?.querySelector?.("form") ?? element;
  if (!form || form.querySelector("[name='flags.axiom.conditional']")) return;

  const checked = Boolean(application.document?.getFlag?.("axiom", "conditional"));
  const field = document.createElement("div");
  field.className = "form-group axiom-conditional-effect-field";
  field.innerHTML = `
    <label class="checkbox">
      <input type="checkbox" name="flags.axiom.conditional" ${checked ? "checked" : ""}>
      <span>${game.i18n.localize("AXIOM.Actor.Effects.Conditional")}</span>
    </label>
    <p class="hint">${game.i18n.localize("AXIOM.Actor.Effects.ConditionalHint")}</p>
  `;

  const footer = form.querySelector("footer, .form-footer, .sheet-footer");
  if (footer) footer.before(field);
  else form.append(field);

  field.querySelector("input")?.addEventListener("change", event => {
    application.document?.setFlag?.("axiom", "conditional", event.currentTarget.checked);
  });
});

registerAxiomStatusHooks();
registerAxiomTokenHUD();
registerAxiomCombatTracker();
registerAxiomTokenOverlays();
Hooks.on("combatStart", combat => AxiomCombat.onCombatStart(combat));
Hooks.on("updateCombat", (combat, changed) => {
  const turnChanged = foundry.utils.hasProperty(changed, "turn");
  const roundChanged = foundry.utils.hasProperty(changed, "round");
  const passChanged = foundry.utils.hasProperty(changed, "flags.axiom.pass");
  if (!turnChanged && !roundChanged && !passChanged) return;
  AxiomCombat.onCombatTurnStart(combat);
});

async function preloadTemplates() {
  return loadTemplates([
    "systems/axiom/templates/sheets/actor/partials/header.hbs",
    "systems/axiom/templates/sheets/actor/partials/tabs.hbs",
    "systems/axiom/templates/sheets/actor/tabs/main.hbs",
    "systems/axiom/templates/sheets/actor/tabs/combat.hbs",
    "systems/axiom/templates/sheets/actor/tabs/skills.hbs",
    "systems/axiom/templates/sheets/actor/tabs/equipment.hbs",
    "systems/axiom/templates/sheets/actor/tabs/effects.hbs",
    "systems/axiom/templates/sheets/actor/tabs/details.hbs",
    "systems/axiom/templates/sheets/actor/npc-sheet.hbs",
    "systems/axiom/templates/apps/roll-window.hbs",
    "systems/axiom/templates/chat/roll-card.hbs",
    "systems/axiom/templates/chat/opposed-test-card.hbs",
    "systems/axiom/templates/chat/combat-result-card.hbs",
    "systems/axiom/templates/sheets/item/partials/header.hbs",
    "systems/axiom/templates/sheets/item/partials/tabs.hbs",
    "systems/axiom/templates/sheets/item/tabs/description.hbs",
    "systems/axiom/templates/sheets/item/tabs/skill-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/armor-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/shield-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/weapon-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/equipment-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/trait-details.hbs",
    "systems/axiom/templates/sheets/item/tabs/effects.hbs"
  ]);
}
