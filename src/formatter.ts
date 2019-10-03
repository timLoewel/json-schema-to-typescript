import { format as prettify } from 'prettier'
import { Options } from './'

export function format(code: string, options: Options): string {
  try {
    return prettify(code, { parser: 'typescript', ...options.style })
  } catch (e) {
    console.error(code)
    throw e
  }
}
