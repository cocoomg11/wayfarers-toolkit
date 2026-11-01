import { wanderersConfig } from "./vendor/wanderers-core/config/eslint.base.mjs";

// Tests stub Foundry's globals (tests/_globals.mjs) and read them back.
const testGlobals = Object.fromEntries(["game", "ui", "foundry", "CONFIG", "CONST", "Hooks", "canvas", "ChatMessage", "fromUuid", "fromUuidSync"].map(n => [n, "readonly"]));

export default [
  ...wanderersConfig({ ignores: ["packs/", "src/packs/"] }),
  { files: ["tests/**/*.mjs"], languageOptions: { globals: testGlobals } }
];
