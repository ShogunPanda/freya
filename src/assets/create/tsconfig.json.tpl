{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "outDir": "dist",
    "allowJs": false,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strictNullChecks": true,
    "useUnknownInCatchVariables": false,
    "baseUrl": ".",
    "paths": {
      "@freya/*": ["node_modules/freya-slides/dist/*"]
    },
    "lib": ["dom", "dom.iterable", "esnext"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
