#!/usr/bin/env node

import { whiteBright } from 'cli-color'
import fs = require('fs')
import getstdin = require('get-stdin')
import * as _glob from 'glob'
import isGlob = require('is-glob')
import { ResolverOptions } from 'json-schema-ref-parser'
import { basename, dirname, extname, join, relative, resolve } from 'path'
import { promisify } from 'util'
import yargs = require('yargs')
import { compile, Options } from './index'
import { JSONSchema } from './types/JSONSchema'

const { mkdir, readFile, writeFile } = fs.promises
const glob = promisify(_glob)
const opts = yargs
  .usage('$0 [input] [output]', 'transform schemas into types')
  .option('input', {
    alias: 'i',
    type: 'string',
    array: true,
    description: 'array of input schemas to transform, set to - for stdin',
    default: '-'
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'file to write stuff out to'
  })
  .option('cwd', {
    description: 'Root directory for resolving $ref',
    type: 'string',
    required: true,
    default: process.cwd()
  })
  .option('declareExternallyReferenced', {
    boolean: true,
    default: false,
    description: 'Declare external schemas referenced via \'$ref\'?'
  })
  .option('enableConstEnums', {
    boolean: true,
    description: 'Prepend enums with \'const\'?'
  })
  .option('unreachableDefinitions', {
    boolean: true,
    description: 'Generates code for definitions that aren\'t referenced by the schema'
  })
  .option('strictIndexSignatures', {
    boolean: true,
    default: true
  })
  .option('style', {
    description: 'Prettier configuration'
  })
  .help()
  .argv

main(opts)

function unwrap(x: string[] | string) {
  return Array.isArray(x) && x.length === 1 ? x[0] : x
}

async function main(argv: typeof opts) {
  const input = unwrap(argv.input || argv._[0])
  const output = typeof argv.output === 'string'
    ? argv.output
    : argv._[1]

  try {
    await processFiles(input, output, argv as Partial<Options>)
  } catch (e) {
    console.error(whiteBright.bgRedBright('error'), e)
    process.exit(1)
  }
}

type Output = { dir?: string, file?: string }
type SchemaMap = Map<string, { file: string, schema: JSONSchema }>

async function processFiles(argIn: string | string[], argOut: string, argv: Partial<Options>): Promise<void> {
  try {
    let files: string[]
    if (typeof argIn === 'string' && isGlob(argIn)) {
      files = await glob(join(process.cwd(), argIn))

      if (files.length === 0) {
        throw new Error('No files match glob pattern')
      }
    } else if (Array.isArray(argIn)) {
      files = argIn
    } else {
      files = [argIn]
    }

    if (argOut) {
      const base = extname(argOut) ? dirname(argOut) : argOut
      try {
        await mkdir(base, { recursive: true, mode: 0o755 })
      } catch (e) {
        if (e.code !== 'EEXIST') {
          throw e
        }
      }
    }

    const schemaMap: SchemaMap = await readFiles(files, argv)
    const base = argv.cwd!
    const resolver: ResolverOptions = {
      order: 1,
      canRead: true,
      async read(file): Promise<string> {
        const id = relative(base, file.url)
        const datum = schemaMap.get(id)
        if (!datum) {
          throw new Error(`cant find ref ${id}`)
        }
        return datum.file
      }
    }

    argv.$refOptions = argv.$refOptions || {}
    argv.$refOptions.resolve = { file: resolver }

    const output: Output = schemaMap.size === 1
      ? { file: argOut }
      : { dir: argOut }

    for (const [path, { schema }] of schemaMap.entries()) {
      await processFile(schema, path, output, argv)
    }
  } catch (e) {
    console.error(whiteBright.bgRedBright('error'), e)
    process.exit(1)
  }
}

async function readFiles(files: string[], argv: Partial<Options>): Promise<SchemaMap> {
  const schemaMap: SchemaMap = new Map()
  for (const filePath of files) {
    const file = await readInput(filePath)
    let schema
    try {
      schema = JSON.parse(file)
    } catch (e) {
      console.error('failed to parse', filePath, file)
      throw e
    }
    const id = schema[argv.id || '$id'] || filePath
    if (schemaMap.has(id)) {
      throw new Error(`duplicate schema for id ${id}`)
    }

    schemaMap.set(id, { file, schema })
  }

  return schemaMap
}

async function processFile(schema: JSONSchema, file: string, out: Output, argv: Partial<Options>): Promise<void> {
  const ts = await compile(schema, file, argv)
  await writeOutput(
    ts,
    out.dir ? join(process.cwd(), out.dir, `${basename(file, '.json')}.d.ts`) : out.file || ''
  )
}

async function readInput(argIn?: string): Promise<string> {
  if (!argIn || argIn === '-') {
    return getstdin()
  }

  return readFile(resolve(process.cwd(), argIn), 'utf-8')
}

async function writeOutput(ts: string, argOut: string): Promise<void> {
  if (!argOut) {
    try {
      process.stdout.write(ts)
    } catch (err) {
      throw err
    }
    return
  }

  return writeFile(argOut, ts)
}
