import { AXIOM } from "./modules/config.mjs";
import { AxiomSettings } from "./modules/settings.mjs";
import axiomActor from "./modules/objects/axiomActor.mjs";
import axiomCharacterSheet from "./modules/sheets/actorCharacterSheet.mjs";
import axiomItem from "./modules/objects/axiomItem.mjs";
import axiomWeaponItemSheet from "./modules/sheets/itemWeaponSheet.mjs";
import axiomArmorItemSheet from "./modules/sheets/itemArmorSheet.mjs";
import axiomSkillItemSheet from "./modules/sheets/itemSkillSheet.mjs";
import axiomAmmoItemSheet from "./modules/sheets/itemAmmoSheet.mjs";
import axiomEquipmentItemSheet from "./modules/sheets/itemEquipmentSheet.mjs";
import AxiomRoll from "./modules/dice/axiom-roll.mjs";
import { AxiomDieTrait, AxiomDieFate } from "./modules/dice/dice.mjs";
import AxiomChat from "./modules/chat.mjs";
import AxiomCombat from "./modules/systems/combat.mjs";

Hooks.once("init", async () => {
  console.log("AXIOM | Initializing Axiom//Core System");

  // Setting up the Global Configuration Object
  CONFIG.AXIOM = AXIOM;
  CONFIG.INIT = true;

  CONFIG.Dice.rolls["AxiomRoll"] = AxiomRoll;
  CONFIG.Dice.terms["t"] = AxiomDieTrait;
  CONFIG.Dice.terms["a"] = AxiomDieFate;

  CONFIG.Actor.documentClass = axiomActor;
  CONFIG.Item.documentClass = axiomItem;

  CONFIG.Combat.documentClass = AxiomCombat;

  AxiomChat.init();
  AxiomSettings.registerSystemSettings();

  const { DocumentSheetConfig } = foundry.applications.apps;

  const sheets = foundry.applications.apps.DocumentSheetConfig;

  // Unregister the core Actor sheet
  sheets.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  // Register the Axiom Actor sheet
  sheets.registerSheet(Actor, "axiom", axiomCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "AXIOM.SheetClassCharacter",
  });

  // Remove the core sheet
  sheets.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);

  // Register Axiom item sheets
  sheets.registerSheet(Item, "axiom", axiomWeaponItemSheet, {
    types: ["weapon"],
    label: "TYPES.item.weapon",
    makeDefault: true,
  });

  sheets.registerSheet(Item, "axiom", axiomArmorItemSheet, {
    types: ["armor"],
    label: "TYPES.item.armor",
    makeDefault: true,
  });

  sheets.registerSheet(Item, "axiom", axiomSkillItemSheet, {
    types: ["skill"],
    label: "TYPES.item.skill",
    makeDefault: true,
  });

  sheets.registerSheet(Item, "axiom", axiomAmmoItemSheet, {
    types: ["ammunition"],
    label: "TYPES.item.ammunition",
    makeDefault: true,
  });

  sheets.registerSheet(Item, "axiom", axiomEquipmentItemSheet, {
    types: ["equipment"],
    label: "TYPES.item.equipment",
    makeDefault: true,
  });

  // Load all Partial-Handlebar Files
  preloadHandlebarsTemplates();

  // Register Additional Handlebar Helpers
  registerHandlebarsHelpers();
});

Hooks.once("ready", async () => {
  //Finished Initialization Phase and release lock
  CONFIG.INIT = false;

  // Only execute when run as Gamemaster
  if (!game.user.isGM) return;
});

function preloadHandlebarsTemplates() {
  const templatePaths = [
    /* -------------------------------------------- */
    /*  ITEM SHEET PARTS                            */
    /* -------------------------------------------- */

    // Item root parts
    "systems/axiom/templates/item/header.hbs",
    "systems/axiom/templates/item/tabs.hbs",

    // Item tab content
    "systems/axiom/templates/item/tabs/description.hbs",
    "systems/axiom/templates/item/tabs/effects.hbs",

    // Item types (details tab)
    "systems/axiom/templates/item/types/skill.hbs",
    "systems/axiom/templates/item/types/weapon.hbs",
    "systems/axiom/templates/item/types/armor.hbs",
    "systems/axiom/templates/item/types/equipment.hbs",
    "systems/axiom/templates/item/types/ammo.hbs",

    /* -------------------------------------------- */
    /*  CHARACTER SHEET PARTS                       */
    /* -------------------------------------------- */

    // Sidebar + Main Tabs Header
    "systems/axiom/templates/actor/sidebar.hbs",
    "systems/axiom/templates/actor/tabs.hbs",

    // Sidebar Mini-Tabs
    "systems/axiom/templates/actor/mini-tabs/attribute-tests.hbs",
    "systems/axiom/templates/actor/mini-tabs/physical-limits.hbs",

    // Main Tabs
    "systems/axiom/templates/actor/tabs/skills.hbs",
    "systems/axiom/templates/actor/tabs/combat.hbs",
    "systems/axiom/templates/actor/tabs/inventory.hbs",
    "systems/axiom/templates/actor/tabs/details.hbs",

    /* -------------------------------------------- */
    /*  CHAT TEMPLATES                             */
    /* -------------------------------------------- */
    "systems/axiom/templates/chat/axiom-roll.hbs",
  ];

  return foundry.applications.handlebars.loadTemplates(templatePaths);
}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("equals", function (v1, v2) {
    return v1 === v2;
  });

  Handlebars.registerHelper("contains", function (element, search) {
    return element.includes(search);
  });

  Handlebars.registerHelper("customConcat", function (s1, s2, s3 = "") {
    return s1 + s2 + s3;
  });

  Handlebars.registerHelper("isGreater", function (p1, p2) {
    return p1 > p2;
  });

  Handlebars.registerHelper("isEqualORGreater", function (p1, p2) {
    return p1 >= p2;
  });

  Handlebars.registerHelper("ifOR", function (conditional1, conditional2) {
    return conditional1 || conditional2;
  });

  Handlebars.registerHelper("doLog", function (value) {
    console.log(value);
  });

  Handlebars.registerHelper("toBoolean", function (string) {
    return string === "true";
  });

  Handlebars.registerHelper("for", function (from, to, incr, content) {
    let result = "";

    for (let i = from; i < to; i += incr) result += content.fn(i);

    return result;
  });

  Handlebars.registerHelper("times", function (n, content) {
    let result = "";

    for (let i = 0; i < n; i++) result += content.fn(i);

    return result;
  });

  Handlebars.registerHelper("notEmpty", function (value) {
    if (value == 0 || value == "0") return true;
    if (value == null || value == "") return false;
    return true;
  });

  Handlebars.registerHelper("math", function (lvalue, operator, rvalue) {
    lvalue = Number(lvalue);
    rvalue = Number(rvalue);

    switch (operator) {
      case "+":
        return lvalue + rvalue;
      case "-":
        return lvalue - rvalue;
      case "*":
        return lvalue * rvalue;
      case "/":
        return lvalue / rvalue;
      default:
        return 0;
    }
  });

  Handlebars.registerHelper("attrValue", function (actor, attrKey) {
    return actor.system.attributes[attrKey]?.value ?? 0;
  });

  Handlebars.registerHelper("capitalize", function (str) {
    if (typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper("isFilled", function (value, index) {
    return value >= index + 1;
  });

  Handlebars.registerHelper("array", function (...args) {
    // Handlebars passes an extra "options" object at the end, so remove it
    return args.slice(0, -1);
  });
}
