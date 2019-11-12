import { JSONSchema, NormalizedJSONSchema } from './types/JSONSchema';
export declare function normalize<T extends JSONSchema>(schema: T, filename?: string): NormalizedJSONSchema<T>;
