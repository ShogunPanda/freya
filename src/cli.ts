import type { Command } from 'commander'
import type pino from 'pino'
import { InvalidArgumentError } from 'commander'
import { setWhitelistedTalks } from './configuration.ts'
import { deploy } from './exports/deploy.ts'
import { performPDF } from './exports/pdf.ts'
import { exportPptx } from './exports/pptx.ts'

function concurrency(value: string): number {
  const parsed = Number(value)
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(parsed)) {
    throw new InvalidArgumentError('Concurrency must be a positive integer.')
  }
  return parsed
}

export function setupCLI(program: Command, logger: pino.Logger): void {
  program
    .name('freya')
    .description('Opinionated JSX based slides generator.')
    .option('-o, --only <string>', 'A comma separated list of talks to build.', '')
  for (const command of program.commands) {
    if (command.name() === 'build') {
      command.description('Builds all the slidesets')
    } else if (command.name() === 'server') {
      command.description('Serves slidesets locally')
    }
    if (['development', 'build'].includes(command.name())) {
      command.hook('preAction', () => {
        setWhitelistedTalks(command.optsWithGlobals().only as string)
      })
    }
  }
  program
    .command('pdf')
    .description('Exports one screenshot-based PDF per slideset')
    .option('--force', 'Regenerate PDFs even when cached inputs match', false)
    .option('-d, --directory <dir>', 'The base output directory (PDFs are written to its pdf subdirectory)', 'dist')
    .option('-c, --concurrency <number>', 'Maximum browsers and maximum tabs per browser', concurrency, 3)
    .option(
      '-s, --scale <NUM>',
      'Screenshot pixel density multiplier',
      value => {
        const scale = Number(value)
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(scale)) {
          throw new InvalidArgumentError('Scale must be a positive integer.')
        }
        return scale
      },
      2
    )
    .alias('p')
    .action(async function (this: Command): Promise<void> {
      try {
        await performPDF(this, logger)
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
  program
    .command('pptx')
    .description('Exports editable PowerPoint presentations from annotated slide layouts')
    .option('--force', 'Regenerate PPTXs even when cached inputs match', false)
    .option('-d, --directory <dir>', 'The directory where to export PPTX files', 'pptx')
    .option('-c, --concurrency <number>', 'Maximum concurrent slide pages', concurrency, 4)
    .alias('x')
    .action(async function (this: Command): Promise<void> {
      try {
        await exportPptx(this, logger)
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
  program
    .command('deploy')
    .description('Build HTML, PDF and PPTX slidesets ready to be deployed on Netlify')
    .option('--force', 'Regenerate exports even when cached inputs match', false)
    .option('-d, --directory <dir>', 'The directory where to build and serve files from', 'dist')
    .option('-c, --concurrency <number>', 'Exporter concurrency (defaults: PDF 3, PPTX 4)', concurrency)
    .option('-p, --no-pdf', 'Skip PDF generation and publication')
    .option('-x, --no-pptx', 'Skip PPTX generation and publication')
    .alias('y')
    .action(async function (this: Command): Promise<void> {
      try {
        await deploy(this, logger)
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
}
