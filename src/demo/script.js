// demo/script.js: the flagship demo script's public name, kept so the
// harnesses that import it by path keep working unchanged. The script itself
// now lives one directory down with every other demo; this file re-exports
// it, and is the only file in src/demo/ that still spells a goal's name —
// necessarily, because the module specifier has to name the file the prompt
// put it in.
//
// Importers that read these names and must not break:
//   test/helpers/parity.mjs        (P13 parity harness, P17's loop)
//   test/gates/p6.probes.mjs
//   test/gates/p9.probes.mjs
//   test/helpers/acceptance.mjs
// New demos are NOT re-exported here; they are reached through
// demo/scripts/index.js, so this file stays one goal's name only.
export * from "./scripts/climbing.js";