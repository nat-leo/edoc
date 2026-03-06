import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["vitest.setup.ts"], // optional
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx", "lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/.next/**", "**/node_modules/**"],
    }
  },
});