const AXIOM_BONE_COLORSET = Object.freeze({
  name: "axiom-bone",
  description: "Axiom//Core Bone",
  category: "Axiom//Core",
  foreground: "#e8e4dc",
  background: "#24242a",
  outline: "#101012",
  edge: "#d8c69a",
  texture: "none",
  material: "plastic",
  font: "Marcellus"
});

/**
 * Register Axiom//Core Dice So Nice appearance defaults.
 *
 * Dice So Nice emits this hook when its 3D dice API is ready. If the module is
 * not installed or enabled, this hook never fires and the system continues
 * without any custom dice behavior.
 */
export function registerAxiomDice() {
  Hooks.once("diceSoNiceReady", dice3d => {
    if (!dice3d?.addColorset) return;

    dice3d.addColorset(AXIOM_BONE_COLORSET, "preferred");
  });
}
