// systems/axiom/scripts/settings.mjs

export class AxiomSettings {
  
  /**
   * Register all Axiom system settings.
   * Called from system initialization (init hook).
   */
  static registerSystemSettings() {

    // Combat settings placeholder (we will populate these in the next steps)
    game.settings.register("axiom", "combatSkillMelee", {
      name: "Melee Combat Skill",
      hint: "Defines which skill is used for melee attacks. Change only if you have custom skill names.",
      scope: "world",
      config: true,
      type: String,
      default: "Melee"
    });

    game.settings.register("axiom", "useHitLocations", {
      name: "Enable Hit Locations",
      hint: "If enabled, attacks will roll on the hit location table.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });
  }
}
