import N3, { Prefixes, NamedNode } from "n3";
import { Quad, DatasetCore } from '@rdfjs/types';
const { Store, Parser, DataFactory } = N3;

export class ParserResult {
  constructor(public dataset: DatasetCore, public prefixes: Prefixes){
  }
}

/**
 * Wrapper around N3.Parser.parse to convert from callback style to Promise.
 * @param text Text to parse. Either Turtle, N-Triples or N-Quads.
 * @param source
 */
export const parseTurtle = async (text: string, source = ''): Promise<ParserResult> => {
  const store = new Store();
  return new Promise((resolve, reject) => {
    const parserOptions: { baseIRI?: string } = {};
    if (source) {
      parserOptions.baseIRI = source;
    }
    const parser = new Parser({ ...parserOptions });
    parser.parse(text, (error: Error, quad: Quad, parse: Prefixes) => {
      if (error) {
        reject(error);
      }
      if (quad) {
        console.log(quad)
        store.add(DataFactory.quad(quad.subject, quad.predicate, quad.object));
      } else {
        resolve(new ParserResult(store, parse));
      }
    });
  });
};