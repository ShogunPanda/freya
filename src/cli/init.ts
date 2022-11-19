import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { rootDir } from '../generation/loader.js'

const templates = {
  'src/talks/@NAME@.yml': `
  ---
  config:
    theme: main
    dimensions:
      width: 2000
      height: 1120
  document:
    title:
    author:
      name:
      description:
      email:
  slides:
  `,
  'src/themes/main/theme.yml': `
  ---
style: style.css
images:
fonts:
  ranges:
  families:
  `,
  'src/themes/main/style.css': `
@import 'virtual:theme-fonts';
@import '@freya/normalize.css';
@import '@freya/reset.css';
  `,
  'src/themes/main/unocss.config.ts': `
import { defineUnoConfig } from '@freya/generation/css.js'

export default defineUnoConfig({
})
  `,
  'src/themes/main/layouts/default.tsx': `
import { parseContent } from '@freya/generation/generator.js'
import { Slide, SlideProps } from '@freya/generation/models.js'

export default function DefaultLayout({ slide, index }: SlideProps<Slide>): JSX.Element {
  const { title, content } = slide

  return (
    <div key={\`slide:\${index}\`}>
      <h1 dangerouslySetInnerHTML={{ __html: parseContent(title) }} />

      {content?.filter(Boolean).map((c: string, contentIndex: number) => (
        <h4 key={\`content:\${index}:\${contentIndex}\`} dangerouslySetInnerHTML={{ __html: parseContent(c) }}/>
      ))}
    </div>
  )
}
  `,
  '.eslintrc.json': `
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "tsconfig.json"
  },
  "extends": ["@cowtech/eslint-config/react-with-typescript"],
  "overrides": [
    {
      "files": ["*.js"],
      "parser": "espree",
      "parserOptions": {
        "ecmaVersion": 2020
      },
      "extends": ["@cowtech/eslint-config"],
      "rules": {
        "@typescript-eslint/typedef": 0,
        "@typescript-eslint/require-await": 0
      }
    }
  ]
}

  `,
  'package.json': `
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
    "freya-slides": "^@VERSION@",
    "react": "^18.2.0",
    "tsx": "^3.12.1"
  },
  "devDependencies": {
    "@cowtech/eslint-config": "^8.7.5",
    "@types/react": "^18.0.25",
    "eslint": "^8.26.0",
    "prettier": "^2.7.1"
  }
}
  `,
  'prettier.config.cjs': `
module.exports = {
  printWidth: 120,
  semi: false,
  singleQuote: true,
  bracketSpacing: true,
  trailingComma: 'none',
  arrowParens: 'avoid'
}
  `,
  'tsconfig.json': `
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
  `
}

function compile(template: string, variables: Record<string, string>): string {
  return template.replace(/(@([A-Z]+)@)/g, (_, all: string, name: string) => {
    return variables[name] ?? all
  })
}

export async function init(name: string, directory: string): Promise<void> {
  console.log(name, directory)
  const packageJson = JSON.parse(await readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'))
  const logger = pino({ transport: { target: 'pino-pretty' } })
  const fullOutput = resolve(rootDir, directory)

  // Check if the output directory is not empty
  try {
    const files = await readdir(fullOutput)

    if (files.filter(f => !f.startsWith('.'))) {
      logger.error(`Directory ${relative(rootDir, directory)} is not empty. Aborting.`)
      process.exit(1)
    }
  } catch (error) {
    if (error.code === 'ENOTDIR') {
      logger.error(`Path ${relative(rootDir, directory)} already exists and it is not a directory. Aborting.`)
      process.exit(1)
    } else if (error.code !== 'ENOENT') {
      throw error
    }
  }

  // Create the main directory
  await mkdir(fullOutput, { recursive: true })

  // Create the structure for the talk
  await mkdir(resolve(fullOutput, 'src/talks/assets'), { recursive: true })

  // Create the structure for the theme
  await mkdir(resolve(fullOutput, 'src/themes/main/assets/'), { recursive: true })
  await mkdir(resolve(fullOutput, 'src/themes/main/layouts/'), { recursive: true })

  const variables = {
    NAME: name,
    VERSION: packageJson.version
  }

  // Create all files
  for (const [file, template] of Object.entries(templates)) {
    const destination = compile(resolve(fullOutput, file), variables)

    logger.info(`Creating file ${relative(fullOutput, destination)} ...`)
    await writeFile(destination, compile(template.trim(), variables), 'utf8')
  }
}
