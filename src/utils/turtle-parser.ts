import N3 from "n3";
import { Quad, DatasetCore } from '@rdfjs/types';
const { Store, Parser, DataFactory } = N3;

/**
 * Wrapper around N3.Parser.parse to convert from callback style to Promise.
 * @param text Text to parse. Either Turtle, N-Triples or N-Quads.
 * @param source
 */

export async function parseTurtle(text: string): Promise<DatasetCore> {
    const store = new Store();
    return new Promise((resolve, reject) => {
        const parser = new Parser();
        parser.parse(text, (error: Error, quad: Quad) => {
            if (error) {
                reject(error);
            }
            if (quad) {
                store.add(DataFactory.quad(quad.subject, quad.predicate, quad.object, DataFactory.defaultGraph()));
            } else {
                resolve(store);
            }
        });
    });
};
