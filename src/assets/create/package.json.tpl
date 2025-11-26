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
    "postbuild": "npm run lint && npm run npm:lint:css && tsc -p . --noEmit",
    "serve": "freya server",
    "png": "freya png",
    "pdf": "freya pdf",
    "format": "prettier -w src",
    "lint": "eslint --cache",
    "lint:css": "stylelint --cache src/**/*.css"
  },
  "dependencies": {
    "@perseveranza-pets/freya": "^@VERSION@"
  },
  "devDependencies": {
    "@cowtech/eslint-config": "^11.0.0",
    "@cowtech/stylelint-config": "^2.0.1",
    "@cowtech/typescript-config": "^0.2.2",
    "eslint": "^9.39.1",
    "pino": "^10.1.0",
    "prettier": "^3.6.2",
    "stylelint": "^16.26.0",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">= 22.21.0"
  }
}
