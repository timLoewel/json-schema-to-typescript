import $RefParser = require('@cappasityinc/json-schema-ref-parser')
import { whiteBright } from 'cli-color'
import { JSONSchema } from './types/JSONSchema'
import { log } from './utils'

export async function dereference(
  schema: JSONSchema,
  { cwd, $refOptions }: { cwd: string, $refOptions: $RefParser.Options }
): Promise<[JSONSchema, $RefParser.$Refs]> {
  log(whiteBright.bgGreen('resolver'), schema, cwd)
  const parser = new $RefParser
  const refs = await parser.resolve(cwd, schema, $refOptions)

  if (refs.circular) {
    throw new Error('$refs contains circular references')
  }

  return [schema, refs]
}
