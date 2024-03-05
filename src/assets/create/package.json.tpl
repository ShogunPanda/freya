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
    "lint": "eslint --cache --ext .js,.jsx,.ts,.tsx src",
    "lint:css": "stylelint --cache src/**/*.css",
    "typecheck": "tsc -p . --emitDeclarationOnly"
  },
  "dependencies": {
    "@perseveranza-pets/freya": "^@VERSION@"
  },
  "devDependencies": {
    "@cowtech/eslint-config": "^9.0.3",
    "@cowtech/stylelint-config": "^0.2.0",
    "concurrently": "^8.2.2",
    "eslint": "^8.26.0",
    "prettier": "^2.7.1",
    "stylelint": "^16.2.1",
    "typescript": "^5.3.3"
  }
}