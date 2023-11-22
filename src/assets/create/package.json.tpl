{
  "name": "@NAME@",
  "version": "0.1.0",
  "description": "",
  "homepage": "",
  "repository": "",
  "bugs": {
    "url": ""
  },
  "author": "",
  "license": "",
  "licenses": [
    {
      "type": "",
      "url": ""
    }
  ],
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "freya development",
    "build": "freya build",
    "postbuild": "concurrently npm:lint npm:typecheck",
    "serve": "freya server",
    "jpeg": "freya jpeg",
    "pdf": "freya pdf",
    "format": "prettier -w src",
    "lint": "eslint --cache --ext .js,.jsx,.ts,.tsx src",
    "typecheck": "tsc -p . --emitDeclarationOnly"
  },
  "dependencies": {
    "@unocss/transformer-directives": "^0.46.5",
    "@unocss/preset-wind": "^0.46.5",
    "freya-slides": "^@VERSION@",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@cowtech/eslint-config": "^8.7.5",
    "@types/react": "^18.0.25",
    "concurrently": "^8.2.2",
    "eslint": "^8.26.0",
    "prettier": "^2.7.1"
  }
}