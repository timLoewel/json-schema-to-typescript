#!/usr/bin/env node

import { whiteBright } from 'cli-color'
import { JSONSchema4 } from 'json-schema'
import minimist = require('minimist')
import { readFile, writeFile, mkdir, existsSync } from 'mz/fs'
import * as _glob from 'glob'
import isGlob = require('is-glob')
import { promisify } from 'util'
import { join, resolve, basename } from 'path'
import stdin = require('stdin')
import { compile, Options } from './index'

const glob = promisify(_glob)

main(minimist(process.argv.slice(2), {
  alias: {
    help: ['h'],
    input: ['i'],
    output: ['o'],
    recursive: ['r']
  }
}))

async function main(argv: minimist.ParsedArgs) {

  if (argv.help) {
    printHelp()
    process.exit(0)
  }

  const argIn: string = argv._[0] || argv.input
  const argOut: string = argv._[1] || argv.output

  try {
    if (isGlob(argIn)) {
      if (!existsSync(argOut)) {
        await mkdir(argOut)
      }

      const files = await glob(join(process.cwd(), argIn))
      const processFiles = files.map(file => processFile(file, { dir: argOut }, argv as Partial<Options>))
      await Promise.all(processFiles)
    } else {
      await processFile(argIn, { file: argOut }, argv as Partial<Options>)
    }
  } catch (e) {
    console.error(whiteBright.bgRedBright('error'), e)
    process.exit(1)
  }
}

function processFile(file: string, out: {dir?: string, file?: string}, argv: Partial<Options>) {
  return new Promise(async (res, rej) => {
    try {
      const schema = JSON.parse(await readInput(file))
      const ts = await compile(schema, file, argv)
      await writeOutput(
        ts,
        out.dir ? join(process.cwd(), out.dir, `${basename(file, '.json')}.d.ts`) : out.file || ''
      )
      res()
    } catch (err) {
      rej(err)
    }
  })
}

function readInput(argIn?: string) {
  if (!argIn) {
    return new Promise(stdin)
  }
  return readFile(resolve(process.cwd(), argIn), 'utf-8')
}

function writeOutput(ts: string, argOut: string): Promise<void> {
  if (!argOut) {
    try {
      process.stdout.write(ts)
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err)
    }
  }
  return writeFile(argOut, ts)
}

function printHelp() {
  const pkg = require('../../package.json')

  process.stdout.write(
`
${pkg.name} ${pkg.version}
Usage: json2ts [--input, -i] [IN_FILE] [--output, -o] [OUT_FILE] [OPTIONS]

With no IN_FILE, or when IN_FILE is -, read standard input.
With no OUT_FILE and when IN_FILE is specified, create .d.ts file in the same directory.
With no OUT_FILE nor IN_FILE, write to standard output.

You can use any of the following options by adding them at the end.
Boolean values can be set to false using the 'no-' prefix.

  --cwd=XXX
      Root directory for resolving $ref
  --declareExternallyReferenced
      Declare external schemas referenced via '$ref'?
  --enableConstEnums
      Prepend enums with 'const'?
  --style.XXX=YYY
      Prettier configuration
  --unreachableDefinitions
      Generates code for definitions that aren't referenced by the schema
`
  )
}
