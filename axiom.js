import { AXIOM } from "./modules/config.js";
import axiomActor from "./modules/objects/axiomActor.js";
import axiomCharacterSheet from "./modules/sheets/axiomCharacterSheet.js";
import axiomItem from "./modules/objects/axiomItem.js";
import axiomItemSheet from "./modules/sheets/axiomItemSheet.js";


Hooks.once("init", async () => {
  console.log("AXIOM | Initializing Axiom//Core System");

  // Setting up the Global Configuration Object
  CONFIG.AXIOM = AXIOM;
  CONFIG.INIT = true;
  CONFIG.Actor.documentClass = axiomActor;
  CONFIG.Item.documentClass = axiomItem;

  const { DocumentSheetConfig } = foundry.applications.apps;

  const actorClass = CONFIG.Actor.documentClass;
  const itemClass = CONFIG.Item.documentClass;

  DocumentSheetConfig.unregisterSheet(
    actorClass,
    "core",
    foundry.appv1.sheets.ActorSheet
  );

  DocumentSheetConfig.registerSheet(actorClass, "axiom", axiomCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "AXIOM.SheetClassCharacter",
  });

  DocumentSheetConfig.unregisterSheet(
    itemClass,
    "core",
    foundry.appv1.sheets.ItemSheet
  );

  DocumentSheetConfig.registerSheet(itemClass, "axiom", axiomItemSheet, {
    types: ["skill", "weapon", "armor"],
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
}
