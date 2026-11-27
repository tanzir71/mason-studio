/** Types for @bramus/specificity 2.4.5: its package.json "exports" hides its own index.d.ts from TypeScript (nodenext). */
declare module "@bramus/specificity" {
  export interface SpecificityValue { a: number; b: number; c: number }
  export default class Specificity {
    static calculate(selector: string): { value: SpecificityValue }[];
  }
}
