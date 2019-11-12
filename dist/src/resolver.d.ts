import $RefParser = require('@cappasityinc/json-schema-ref-parser');
import { JSONSchema } from './types/JSONSchema';
export declare function dereference(schema: JSONSchema, { cwd, $refOptions }: {
    cwd: string;
    $refOptions: $RefParser.Options;
}): Promise<[JSONSchema, $RefParser.$Refs]>;
