import N3 from "n3";
import { Quad, DatasetCore } from '@rdfjs/types';
const { Store, Parser, DataFactory } = N3;

/**
 * Wrapper around N3.Parser.parse to convert from callback style to Promise.
 * @param text Text to parse. Either Turtle, N-Triples or N-Quads.
 * @param source
 */

export const parseTurtle = async (text: string, source = ''): Promise<DatasetCore> => {
  const store = new Store();
  return new Promise((resolve, reject) => {
    const parserOptions: { baseIRI?: string } = {};
    if (source) {
      parserOptions.baseIRI = source;
    }
    const parser = new Parser({ ...parserOptions });
    parser.parse(text, (error: Error, quad: Quad) => {
      if (error) {
        reject(error);
      }
      if (quad) {
        console.log(quad)
        store.add(DataFactory.quad(quad.subject, quad.predicate, quad.object));
      } else {
        resolve(store);
      }
    });
  });
};