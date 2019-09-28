import { JSONSchema6, JSONSchema6Definition, JSONSchema6Type, JSONSchema6TypeName } from 'json-schema'

export type SCHEMA_TYPE = 'ALL_OF' | 'UNNAMED_SCHEMA' | 'ANY' | 'ANY_OF'
  | 'BOOLEAN' | 'NAMED_ENUM' | 'NAMED_SCHEMA' | 'NULL' | 'NUMBER' | 'STRING'
  | 'OBJECT' | 'ONE_OF' | 'TYPED_ARRAY' | 'REFERENCE' | 'UNION' | 'UNNAMED_ENUM'
  | 'UNTYPED_ARRAY' | 'CUSTOM_TYPE'

export type JSONSchemaTS = {
  /**
   * schema extension to support numeric enums
   */
  tsEnumNames?: string[]
  /**
   * schema extension to support custom types
   */
  tsType?: string
}

export type JSONSchemaTypeName = JSONSchema6TypeName
export type JSONSchemaType = JSONSchema6Type
export type JSONSchemaDefinition = JSONSchema6Definition
export type JSONSchema = JSONSchema6 & JSONSchemaTS

// const SCHEMA_PROPERTIES = [
//   'additionalItems', 'additionalProperties', 'items', 'definitions',
//   'properties', 'patternProperties', 'dependencies', 'allOf', 'anyOf',
//   'oneOf', 'not', 'required', '$schema', 'title', 'description',
// ]

// export function isSchema(a: any): a is SchemaSchema {
//   return []
// }

export type NormalizedJSONSchema<T extends JSONSchema> = T & {
  additionalItems?: boolean | NormalizedJSONSchema<T>
  additionalProperties: boolean | NormalizedJSONSchema<T>
  items?: NormalizedJSONSchema<T> | NormalizedJSONSchema<T>[]
  definitions?: {
    [k: string]: NormalizedJSONSchema<T>
  }
  properties?: {
    [k: string]: NormalizedJSONSchema<T>
  }
  patternProperties?: {
    [k: string]: NormalizedJSONSchema<T>
  }
  dependencies?: {
    [k: string]: NormalizedJSONSchema<T> | string[]
  }
  allOf?: NormalizedJSONSchema<T>[]
  anyOf?: NormalizedJSONSchema<T>[]
  oneOf?: NormalizedJSONSchema<T>[]
  not?: NormalizedJSONSchema<T>
  required: string[]
}

export type EnumJSONSchema<T> = NormalizedJSONSchema<T> & {
  enum: any[]
}

export type NamedEnumJSONSchema<T> = NormalizedJSONSchema<T> & {
  tsEnumNames: string[]
}

export type SchemaSchema<T> = NormalizedJSONSchema<T> & {
  properties: {
    [k: string]: NormalizedJSONSchema<T>
  }
  required: string[]
}

export type JSONSchemaWithDefinitions<T> = NormalizedJSONSchema<T> & {
  definitions: {
    [k: string]: NormalizedJSONSchema<T>
  }
}

export type CustomTypeJSONSchema<T> = NormalizedJSONSchema<T> & {
  tsType: string
}
