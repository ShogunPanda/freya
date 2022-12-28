{
  "env": {
    "targets": "node >= 16"
  },
  "jsc": {
    "target": "es2022",
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "dynamicImport": true
    },
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    }
  }
}
