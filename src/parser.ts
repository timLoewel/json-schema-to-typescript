import $RefsResolver = require('@cappasityinc/json-schema-ref-parser')
import { whiteBright } from 'cli-color'
import { findKey, includes, isPlainObject, map } from 'lodash'
import { Options } from './'
import { typeOfSchema } from './typeOfSchema'
import { AST, T_ANY, T_ANY_ADDITIONAL_PROPERTIES, TInterface, TInterfaceParam, TTuple } from './types/AST'
import { JSONSchema, JSONSchemaType, JSONSchemaTypeName, JSONSchemaWithDefinitions, SchemaSchema } from './types/JSONSchema'
import { generateName, log, toSafeString } from './utils'

export type Processed = Map<JSONSchema | JSONSchemaType, AST>

export type UsedNames = Set<string>

export function parse<T extends JSONSchema>(
  refs: $RefsResolver.$Refs,
  schema: T | JSONSchemaType,
  options: Options,
  rootSchema = schema as JSONSchema,
  keyName?: string,
  isSchema = true,
  processed: Processed = new Map(),
  usedNames: UsedNames = new Set()
): AST {

  // If we've seen this node before, return it.
  if (processed.has(schema)) {
    return processed.get(schema)!
  }

  const definitions = getDefinitions(rootSchema)
  const keyNameFromDefinition = findKey(definitions, _ => _ === schema)

  // Cache processed ASTs before they are actually computed, then update
  // them in place using set(). This is to avoid cycles.
  // TODO: Investigate alternative approaches (lazy-computing nodes, etc.)
  let ast = {} as AST
  processed.set(schema, ast)
  const set = (_ast: AST) => Object.assign(ast, _ast)

  return isSchema
    ? parseNonLiteral(refs, schema as SchemaSchema<T>, options, rootSchema, keyName, keyNameFromDefinition, set, processed, usedNames)
    : parseLiteral(schema, keyName, keyNameFromDefinition, set)
}

function parseLiteral(
  schema: JSONSchemaType,
  keyName: string | undefined,
  keyNameFromDefinition: string | undefined,
  set: (ast: AST) => AST
) {
  return set({
    keyName,
    params: schema,
    standaloneName: keyNameFromDefinition,
    type: 'LITERAL'
  })
}

function parseNonLiteral<T extends JSONSchema>(
  refs: $RefsResolver.$Refs,
  schema: T,
  options: Options,
  rootSchema: T,
  keyName: string | undefined,
  keyNameFromDefinition: string | undefined,
  set: (ast: AST) => AST,
  processed: Processed,
  usedNames: UsedNames
) {

  log(whiteBright.bgBlue('parser'), schema, '<-' + typeOfSchema(schema), processed.has(schema) ? '(FROM CACHE)' : '')

  switch (typeOfSchema(schema)) {
    case 'ALL_OF':
      return set({
        comment: schema.description,
        keyName,
        params: schema.allOf!.map(_ => parse(refs, _, options, rootSchema, undefined, true, processed, usedNames)),
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'INTERSECTION'
      })
    case 'ANY':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'ANY'
      })
    case 'ANY_OF':
      return set({
        comment: schema.description,
        keyName,
        params: schema.anyOf!.map(_ => parse(refs, _, options, rootSchema, undefined, true, processed, usedNames)),
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'UNION'
      })
    case 'BOOLEAN':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'BOOLEAN'
      })
    case 'CUSTOM_TYPE':
      return set({
        comment: schema.description,
        keyName,
        params: schema.tsType!,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'CUSTOM_TYPE'
      })
    case 'NAMED_ENUM':
      return set({
        comment: schema.description,
        keyName,
        params: schema.enum!.map((_, n) => ({
          ast: parse(refs, _, options, rootSchema, undefined, false, processed, usedNames),
          keyName: schema.tsEnumNames![n]
        })),
        standaloneName: standaloneName(schema, keyName, usedNames)!,
        type: 'ENUM'
      })
    case 'NAMED_SCHEMA':
      return set(newInterface(refs, schema as SchemaSchema<T>, options, rootSchema, processed, usedNames, keyName))
    case 'NULL':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'NULL'
      })
    case 'NUMBER':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'NUMBER'
      })
    case 'OBJECT':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'OBJECT'
      })
    case 'ONE_OF':
      return set({
        comment: schema.description,
        keyName,
        params: schema.oneOf!.map(_ => parse(refs, _, options, rootSchema, undefined, true, processed, usedNames)),
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'UNION'
      })
    case 'REFERENCE':
      const ref = schema.$ref!
      const resolvedRef = refs.get(ref) as T | null
      if (!resolvedRef) {
        throw new Error(`failed to resolve ${schema.$ref}`)
      }

      const originalRef = refs._get$Ref(ref)!
      const parentId = definitionStandaloneName('', originalRef.value as T)
      const relativePath = definitionStandaloneName(ref.split('#')[1] || '')

      return set({
        comment: resolvedRef.description,
        keyName,
        params: `${parentId}${relativePath}`,
        type: 'REFERENCE'
      })
    case 'STRING':
      return set({
        comment: schema.description,
        keyName,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'STRING'
      })
    case 'TYPED_ARRAY':
      if (Array.isArray(schema.items)) {
        // normalised to not be undefined
        const minItems = schema.minItems!
        const maxItems = schema.maxItems!
        const arrayType: TTuple = {
          comment: schema.description,
          keyName,
          maxItems,
          minItems,
          params: schema.items.map(_ => parse(refs, _, options, rootSchema, undefined, true, processed, usedNames)),
          standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
          type: 'TUPLE'
        }
        if (schema.additionalItems === true) {
          arrayType.spreadParam = {
            type: 'ANY'
          }
        } else if (schema.additionalItems) {
          arrayType.spreadParam = parse(refs, schema.additionalItems, options, rootSchema, undefined, true, processed, usedNames)
        }
        return set(arrayType)
      } else {
        const params = parse(refs, schema.items!, options, rootSchema, undefined, true, processed, usedNames)
        return set({
          comment: schema.description,
          keyName,
          params,
          standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
          type: 'ARRAY'
        })
      }
    case 'UNION':
      return set({
        comment: schema.description,
        keyName,
        params: (schema.type as JSONSchemaTypeName[]).map(_ => parse(refs, { type: _ }, options, rootSchema, undefined, true, processed, usedNames)),
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'UNION'
      })
    case 'UNNAMED_ENUM':
      return set({
        comment: schema.description,
        keyName,
        params: schema.enum!.map(_ => parse(refs, _, options, rootSchema, undefined, false, processed, usedNames)),
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'UNION'
      })
    case 'UNNAMED_SCHEMA':
      return set(newInterface(refs, schema as SchemaSchema<T>, options, rootSchema, processed, usedNames, keyName, keyNameFromDefinition))
    case 'UNTYPED_ARRAY':
      // normalised to not be undefined
      const minItems = schema.minItems!
      const maxItems = typeof schema.maxItems === 'number' ? schema.maxItems : -1
      const params = T_ANY
      if (minItems > 0 || maxItems >= 0) {
        return set({
          comment: schema.description,
          keyName,
          maxItems: schema.maxItems,
          minItems,
          // create a tuple of length N
          params: Array(Math.max(maxItems, minItems) || 0).fill(params),
          // if there is no maximum, then add a spread item to collect the rest
          spreadParam: maxItems >= 0 ? undefined : params,
          standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
          type: 'TUPLE'
        })
      }

      return set({
        comment: schema.description,
        keyName,
        params,
        standaloneName: standaloneName(schema, keyNameFromDefinition, usedNames),
        type: 'ARRAY'
      })
  }
}

/**
 * Compute a schema name using a series of fallbacks
 */
function standaloneName(
  schema: JSONSchema,
  keyNameFromDefinition: string | undefined,
  usedNames: UsedNames
) {
  let name = schema.title || schema.$id || keyNameFromDefinition
  if (name) {
    return generateName(name, usedNames)
  }
}

function definitionStandaloneName(ref: string, schema?: JSONSchema): string {
  return toSafeString((schema && (schema.title || schema.$id)) || ref)
}

function newInterface<T extends JSONSchema>(
  refs: $RefsResolver.$Refs,
  schema: SchemaSchema<T>,
  options: Options,
  rootSchema: T,
  processed: Processed,
  usedNames: UsedNames,
  keyName?: string,
  keyNameFromDefinition?: string
): TInterface {
  let name = standaloneName(schema, keyNameFromDefinition, usedNames)!
  return {
    comment: schema.description,
    keyName,
    params: parseSchema(refs, schema, options, rootSchema, processed, usedNames, name),
    standaloneName: name,
    superTypes: [],
    type: 'INTERFACE'
  }
}

/**
 * Helper to parse schema properties into params on the parent schema's type
 */
function parseSchema<T extends JSONSchema>(
  refs: $RefsResolver.$Refs,
  schema: SchemaSchema<T>,
  options: Options,
  rootSchema: T,
  processed: Processed,
  usedNames: UsedNames,
  parentSchemaName: string
): TInterfaceParam[] {

  let asts: TInterfaceParam[] = map(schema.properties, (value, key: string) => ({
    ast: parse(refs, value, options, rootSchema, key, true, processed, usedNames),
    isPatternProperty: false,
    isRequired: includes(schema.required || [], key),
    isUnreachableDefinition: false,
    keyName: key
  }))

  let singlePatternProperty = false
  if (schema.patternProperties) {
    // partially support patternProperties. in the case that
    // additionalProperties is not set, and there is only a single
    // value definition, we can validate against that.
    singlePatternProperty = (
      !schema.additionalProperties && Object.keys(schema.patternProperties).length === 1
    )

    asts = asts.concat(map(schema.patternProperties, (value, key: string) => {
      let ast = parse(refs, value, options, rootSchema, key, true, processed, usedNames)
      let comment = `This interface was referenced by \`${parentSchemaName}\`'s JSON-Schema definition
via the \`patternProperty\` "${key}".`
      ast.comment = ast.comment ? `${ast.comment}\n\n${comment}` : comment
      return ({
        ast,
        isPatternProperty: !singlePatternProperty,
        isRequired: singlePatternProperty || includes(schema.required || [], key),
        isUnreachableDefinition: false,
        keyName: singlePatternProperty ? '[k: string]' : key
      })
    }))
  }

  asts = asts.concat(map(schema.definitions, (value, key: string) => {
    let ast = parse(refs, value, options, rootSchema, key, true, processed, usedNames)
    let comment = `This interface was referenced by \`${parentSchemaName}\`'s JSON-Schema
via the \`definition\` "${key}".`
    ast.comment = ast.comment ? `${ast.comment}\n\n${comment}` : comment
    return {
      ast,
      isPatternProperty: false,
      isRequired: includes(schema.required || [], key),
      isUnreachableDefinition: true,
      keyName: key,
      standaloneName: toSafeString(`${parentSchemaName}/Definitions/${key}`)
    }
  }))

  // handle additionalProperties
  switch (schema.additionalProperties) {
    case undefined:
    case true:
      if (singlePatternProperty) {
        return asts
      }
      return asts.concat({
        ast: T_ANY_ADDITIONAL_PROPERTIES,
        isPatternProperty: false,
        isRequired: true,
        isUnreachableDefinition: false,
        keyName: '[k: string]'
      })

    case false:
      return asts

    // pass "true" as the last param because in TS, properties
    // defined via index signatures are already optional
    default:
      return asts.concat({
        ast: parse(refs, schema.additionalProperties, options, rootSchema, '[k: string]', true, processed, usedNames),
        isPatternProperty: false,
        isRequired: true,
        isUnreachableDefinition: false,
        keyName: '[k: string]'
      })
  }
}

type Definitions = { [k: string]: JSONSchema }

/**
 * TODO: Memoize
 */
function getDefinitions(
  schema?: JSONSchema | null | string | number | boolean | any[],
  isSchema = true,
  processed = new Set<JSONSchema>()
): Definitions {
  if (schema == null ||
      typeof schema === 'string' ||
      typeof schema === 'number' ||
      typeof schema === 'boolean'
  ) {
    return {}
  }

  if (Array.isArray(schema)) {
    return schema.reduce((prev, cur) => ({
      ...prev,
      ...getDefinitions(cur, false, processed)
    }), {})
  }

  if (processed.has(schema)) {
    return {}
  }

  processed.add(schema)
  if (isPlainObject(schema)) {
    return {
      ...(isSchema && hasDefinitions(schema) ? schema.definitions : {}),
      ...(Object.keys(schema) as Array<keyof typeof schema>).reduce<Definitions>((prev, cur) => ({
        ...prev,
        ...getDefinitions(schema[cur], false, processed)
      }), {})
    }
  }
  return {}
}

/**
 * TODO: Reduce rate of false positives
 */
function hasDefinitions<T extends JSONSchema>(schema: T): schema is JSONSchemaWithDefinitions<T> {
  return 'definitions' in schema
}
