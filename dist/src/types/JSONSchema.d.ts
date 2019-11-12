import { JSONSchema7, JSONSchema7Definition, JSONSchema7Type, JSONSchema7TypeName } from 'json-schema';
export declare type SCHEMA_TYPE = 'ALL_OF' | 'UNNAMED_SCHEMA' | 'ANY' | 'ANY_OF' | 'BOOLEAN' | 'NAMED_ENUM' | 'NAMED_SCHEMA' | 'NULL' | 'NUMBER' | 'STRING' | 'OBJECT' | 'ONE_OF' | 'TYPED_ARRAY' | 'REFERENCE' | 'UNION' | 'UNNAMED_ENUM' | 'UNTYPED_ARRAY' | 'CUSTOM_TYPE';
export declare type JSONSchemaTS = {
    /**
     * schema extension to support numeric enums
     */
    tsEnumNames?: string[];
    /**
     * schema extension to support custom types
     */
    tsType?: string;
};
export declare type JSONSchemaTypeName = JSONSchema7TypeName;
export declare type JSONSchemaType = JSONSchema7Type;
export declare type JSONSchemaDefinition = JSONSchema7Definition;
export declare type JSONSchema = JSONSchema7 & JSONSchemaTS;
export declare type NormalizedJSONSchema<T extends JSONSchema> = T & {
    additionalItems?: boolean | NormalizedJSONSchema<T>;
    additionalProperties: boolean | NormalizedJSONSchema<T>;
    items?: NormalizedJSONSchema<T> | NormalizedJSONSchema<T>[];
    definitions?: {
        [k: string]: NormalizedJSONSchema<T>;
    };
    properties?: {
        [k: string]: NormalizedJSONSchema<T>;
    };
    patternProperties?: {
        [k: string]: NormalizedJSONSchema<T>;
    };
    dependencies?: {
        [k: string]: NormalizedJSONSchema<T> | string[];
    };
    allOf?: NormalizedJSONSchema<T>[];
    anyOf?: NormalizedJSONSchema<T>[];
    oneOf?: NormalizedJSONSchema<T>[];
    not?: NormalizedJSONSchema<T>;
    required: string[];
};
export declare type EnumJSONSchema<T> = NormalizedJSONSchema<T> & {
    enum: any[];
};
export declare type NamedEnumJSONSchema<T> = NormalizedJSONSchema<T> & {
    tsEnumNames: string[];
};
export declare type SchemaSchema<T> = NormalizedJSONSchema<T> & {
    properties: {
        [k: string]: NormalizedJSONSchema<T>;
    };
    required: string[];
};
export declare type JSONSchemaWithDefinitions<T> = NormalizedJSONSchema<T> & {
    definitions: {
        [k: string]: NormalizedJSONSchema<T>;
    };
};
export declare type CustomTypeJSONSchema<T> = NormalizedJSONSchema<T> & {
    tsType: string;
};
