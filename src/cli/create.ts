#!/usr/bin/env node

import { program } from 'commander'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { rootDir } from '../generation/loader.js'

const packageInfo = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'))

const templates = {
  'src/talks/@NAME@/talk.yml': 'talk.yml',
  'src/themes/main/theme.yml': 'theme.yml',
  'src/themes/main/style.css': 'style.css',
  'src/themes/main/unocss.config.ts': 'unocss.config.ts',
  'src/themes/main/layouts/default.tsx': 'layout.tsx',
  '.eslintrc.json': 'eslintrc.json',
  '.swcrc': 'swcrc',
  'package.json': 'package.json',
  'prettier.config.cjs': 'prettier.config.cjs',
  'tsconfig.json': 'tsconfig.json'
}

function compile(template: string, variables: Record<string, string>): string {
  return template.replaceAll(/(@([A-Z]+)@)/g, (_, all: string, name: string) => {
    return variables[name] ?? all
  })
}

export async function initializeSlideset(name: string, directory: string): Promise<void> {
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

  logger.info(`Preparing slideset into directory ${fullOutput} ...`)

  // Create the main directory
  await mkdir(fullOutput, { recursive: true })

  // Create the structure for the talk
  await mkdir(resolve(fullOutput, `src/talks/${name}/assets`), { recursive: true })

  // Create the structure for the theme
  await mkdir(resolve(fullOutput, 'src/themes/main/assets/'), { recursive: true })
  await mkdir(resolve(fullOutput, 'src/themes/main/layouts/'), { recursive: true })

  const variables = {
    NAME: name,
    VERSION: packageJson.version
  }

  // Create all files
  for (const [file, templateFile] of Object.entries(templates)) {
    const destination = compile(resolve(fullOutput, file), variables)

    logger.info(`Creating file ${relative(fullOutput, destination)} ...`)
    const template = await readFile(
      fileURLToPath(new URL(`../assets/create/${templateFile}.tpl`, import.meta.url)),
      'utf8'
    )
    await writeFile(destination, compile(template.trim(), variables), 'utf8')
  }
}

program
  .name('create'.trim())
  .arguments('<name> [directory>')
  .description('Initializes a freya slideset.')
  .version(packageInfo.version, '-V, --version', 'Show version number')
  .helpOption('-h, --help', 'Show this help')
  .addHelpCommand(false)
  .showSuggestionAfterError(true)
  .allowUnknownOption(false)
  .action(async (name: string, directory: string) => {
    try {
      await initializeSlideset(name, directory ?? name)
    } catch (error) {
      console.error(error)
    }
  })

program.parse()
