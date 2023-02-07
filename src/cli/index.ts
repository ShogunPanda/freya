#!/usr/bin/env node

import { Command, program } from 'commander'
import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { rootDir } from '../generation/loader.js'

const logger = pino({ transport: { target: 'pino-pretty' } })
const packageInfo = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'))

program
  .name('freya')
  .description('Opinionated JSX based slides generator.')
  .version(packageInfo.version, '-V, --version', 'Show version number')
  .helpOption('-h, --help', 'Show this help')
  .addHelpCommand(false)
  .showSuggestionAfterError(true)
  .allowUnknownOption(false)
  .action(() => {
    program.help()
  })

program
  .command('development')
  .description('Starts the development server')
  .option('-i, --ip <ip>', 'The IP to listen on', '::')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('dev')
  .alias('d')
  .action(async function devAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { developmentBuilder } = await import('./builders.js')

      // Prepare the target directory
      await rm(resolve(rootDir, 'dist/html'), { force: true, recursive: true })
      await mkdir(resolve(rootDir, 'dist/html'), { recursive: true })

      const { ip, port } = this.optsWithGlobals()

      await Promise.all([developmentBuilder(logger), localServer(ip, port, logger)])
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build all the slides')
  .alias('b')
  .action(async function buildAction(this: Command): Promise<void> {
    try {
      const { productionBuilder } = await import('./builders.js')

      await productionBuilder()
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('server')
  .description('Serve built slides')
  .option('-i, --ip <ip>', 'The IP to listen on', '::')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('serve')
  .alias('s')
  .action(async function serveAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')

      const { ip, port } = this.optsWithGlobals()
      await localServer(ip, port)
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('jpeg')
  .description('Build all the slides as a set of JPEG images files')
  .alias('j')
  .action(async function exportJPEGAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { productionBuilder } = await import('./builders.js')
      const { exportAllAsJPEGs } = await import('./exporters.js')

      // Prepare the target directory
      await rm(resolve(rootDir, 'dist/html'), { force: true, recursive: true })
      await mkdir(resolve(rootDir, 'dist/html'), { recursive: true })

      await productionBuilder()
      const server = await localServer('127.0.0.1', 0, false)
      await exportAllAsJPEGs((server.server.address() as AddressInfo).port)
      await server.close()
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('pdf')
  .description('Build all the slides as PDF files')
  .alias('p')
  .action(async function exportPNGAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { productionBuilder } = await import('./builders.js')
      const { exportAllAsPDFs } = await import('./exporters.js')

      // Prepare the target directory
      await rm(resolve(rootDir, 'dist/html'), { force: true, recursive: true })
      await mkdir(resolve(rootDir, 'dist/html'), { recursive: true })

      await productionBuilder()
      const server = await localServer('127.0.0.1', 0, false)
      await exportAllAsPDFs((server.server.address() as AddressInfo).port)
      await server.close()
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program.parse()
