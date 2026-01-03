import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
