import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: false,
  clean: true,
  format: ['cjs'],
  outDir: 'lib',
  noExternal: [
    "moment",
    "@actions/core",
    "@actions/github",
  ]
})
