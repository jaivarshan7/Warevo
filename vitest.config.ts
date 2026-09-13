import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/types/, replacement: path.resolve(__dirname, "./src/types") },
      { find: /^@\/src\/(.*)/, replacement: path.resolve(__dirname, "./src/$1") },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") }
    ]
  },
  test: {
    environment: "node",
    pool: "forks"
  }
});
