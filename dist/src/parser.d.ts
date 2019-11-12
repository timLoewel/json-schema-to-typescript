import $RefsResolver = require('@cappasityinc/json-schema-ref-parser');
import { Options } from './';
import { AST } from './types/AST';
import { JSONSchema, JSONSchemaType } from './types/JSONSchema';
export declare type Processed = Map<JSONSchema | JSONSchemaType, AST>;
export declare type UsedNames = Set<string>;
export declare function parse<T extends JSONSchema>(refs: $RefsResolver.$Refs, schema: T | JSONSchemaType, options: Options, rootSchema?: JSONSchema, keyName?: string, isSchema?: boolean, processed?: Processed, usedNames?: UsedNames): AST;
