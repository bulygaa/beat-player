import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The playhead is derived from Date.now() - startedAt on every frame. Timers never advance playback.
const TIMER_BAN = "Playback is derived from Date.now() - startedAt; timers must not drive it. See CLAUDE.md.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "setInterval", message: TIMER_BAN },
        { name: "setTimeout", message: TIMER_BAN },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "setInterval", message: TIMER_BAN },
        { object: "window", property: "setTimeout", message: TIMER_BAN },
        { object: "globalThis", property: "setInterval", message: TIMER_BAN },
        { object: "globalThis", property: "setTimeout", message: TIMER_BAN },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
