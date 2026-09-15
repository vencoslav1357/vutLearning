import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    // Většina testů je čistá logika (vyhodnocování, plánovač, míchání),
    // takže node je rychlejší; testy komponent si prostředí vyžádají
    // komentářem // @vitest-environment jsdom nahoře v souboru.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
