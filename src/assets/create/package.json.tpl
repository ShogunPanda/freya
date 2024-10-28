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
    "postbuild": "concurrently npm:lint npm:lint:css npm:typecheck",
    "serve": "freya server",
    "png": "freya png",
    "pdf": "freya pdf",
    "format": "prettier -w src",
    "lint": "eslint --cache",
    "lint:css": "stylelint --cache src/**/*.css",
    "typecheck": "tsc -p . --emitDeclarationOnly"
  },
  "dependencies": {
    "@perseveranza-pets/freya": "^@VERSION@"
  },
  "devDependencies": {
    "@cowtech/eslint-config": "^10.0.0",
    "@cowtech/stylelint-config": "^1.0.0",
    "concurrently": "^9.0.1",
    "eslint": "^9.13.0",
    "pino": "^9.5.0",
    "prettier": "^3.3.3",
    "stylelint": "^16.10.0",
    "typescript": "^5.6.3"
  },
  "engines": {
    "node": ">= 20.18.0"
  }
}
