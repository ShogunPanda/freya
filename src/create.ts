#!/usr/bin/env node

import { rootDir } from '@perseveranza-pets/dante'
import { type Command } from 'commander'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'
import { readFile } from './fs.js'

const packageInfo = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))

const templates = {
  'src/talks/@NAME@/info.yml': 'info.yml',
  'src/talks/@NAME@/slides.yml': 'slides.yml',
  'src/themes/main/theme.yml': 'theme.yml',
  'src/themes/main/classes.css': 'classes.css',
  'src/themes/main/style.css': 'style.css',
  'src/themes/main/layouts/default.tsx': 'layout.tsx',
  'eslint.config.js': 'eslint.config.js',
  '.stylelintrc.json': 'stylelintrc.json',
  '.swcrc': 'swcrc',
  'package.json': 'package.json',
  'prettier.config.js': 'prettier.config.js',
  'tsconfig.json': 'tsconfig.json'
}

function compile(template: string, variables: Record<string, string>): string {
  return template.replaceAll(/(@([A-Z]+)@)/g, (_, all: string, name: string) => {
    return variables[name] ?? all
  })
}

export async function initializeSlideset(name: string, directory: string): Promise<void> {
  const logger = pino({ transport: { target: 'pino-pretty' }, level: process.env.LOG_LEVEL ?? 'info' })
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
    VERSION: packageInfo.version
  }

  // Create all files
  for (const [file, templateFile] of Object.entries(templates)) {
    const destination = compile(resolve(fullOutput, file), variables)

    logger.info(`Creating file ${relative(fullOutput, destination)} ...`)
    const template = await readFile(new URL(`./assets/create/${templateFile}.tpl`, import.meta.url))
    await writeFile(destination, compile(template.trim(), variables), 'utf8')
  }
}

export function createSetupCLI(program: Command, logger: pino.Logger): void {
  program
    .name('create-freya-slideset')
    .description('Initializes a freya slideset.')
    .version(packageInfo.version as string, '-V, --version', 'Show version number')
    .action(async (name: string, directory: string) => {
      try {
        await initializeSlideset(name, directory ?? name)
      } catch (error) {
        logger.error(error)
        process.exit(1)
      }
    })
}
