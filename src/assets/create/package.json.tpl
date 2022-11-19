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
    "dev": "freya dev",
    "build": "freya build",
    "serve": "freya serve",
    "jpeg": "freya jpeg",
    "pdf": "freya pdf",
    "format": "prettier -w src",
    "lint": "eslint src  --ext .ts,.tsx"
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
    "eslint": "^8.26.0",
    "prettier": "^2.7.1"
  }
}