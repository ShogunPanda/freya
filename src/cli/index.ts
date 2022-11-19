#!/usr/bin/env node --no-warnings=loader --loader freya-slides/loader

import { Command, program } from 'commander'
import { readFileSync } from 'node:fs'
import { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { setCurrentMode } from '../generation/mode.js'
import { build } from './build.js'
import { developmentServer } from './development.js'
import { exportJPEGs, exportPDFs } from './export.js'
import { localServer } from './serve.js'

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
  .option('-i, --ip <ip>', 'The IP to listen on', '0.0.0.0')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('d')
  .action(async function devAction(this: Command): Promise<void> {
    try {
      const { ip, port } = this.optsWithGlobals()
      setCurrentMode('development')
      await developmentServer(ip, port)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('build [directory]')
  .description('Build all the slides')
  .alias('b')
  .action(async function buildAction(this: Command, directory: string): Promise<void> {
    try {
      if (!directory || directory === '') {
        directory = 'dist/html'
      }

      setCurrentMode('production')
      await build(directory)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('serve [directory]')
  .description('Serve built slides')
  .option('-i, --ip <ip>', 'The IP to listen on', '0.0.0.0')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('s')
  .action(async function serveAction(this: Command, directory: string): Promise<void> {
    try {
      if (!directory || directory === '') {
        directory = 'dist/html'
      }

      const { ip, port } = this.optsWithGlobals()
      await localServer(directory, ip, port)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('jpeg [directory]')
  .description('Build all the slides as a set of JPEG images files')
  .alias('j')
  .action(async function exportPNGAction(this: Command, directory: string): Promise<void> {
    try {
      if (!directory || directory === '') {
        directory = 'dist/jpeg'
      }

      setCurrentMode('print')
      const server = await developmentServer('127.0.0.1', 0, false)
      await exportJPEGs((server.server.address() as AddressInfo).port, directory)
      await server.close()
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('pdf [directory]')
  .description('Build all the slides as PDF files')
  .alias('p')
  .action(async function exportPNGAction(this: Command, directory: string): Promise<void> {
    try {
      if (!directory || directory === '') {
        directory = 'dist/pdf'
      }

      setCurrentMode('print')
      const server = await developmentServer('127.0.0.1', 0, false)
      await exportPDFs((server.server.address() as AddressInfo).port, directory)
      await server.close()
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program.parse()
