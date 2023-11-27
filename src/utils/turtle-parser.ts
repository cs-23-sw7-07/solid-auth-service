import N3, { Prefixes } from "n3";
import { Quad, DatasetCore } from "@rdfjs/types";
const { Store, Parser, DataFactory } = N3;

/**
 * The result of parseTurtle function.
 * @field dataset contains the quads of the parsed resource
 * @field prefixes contains the prefixes of the parsed resource
 */
export class ParserResult {
    constructor(
        public dataset: DatasetCore,
        public prefixes: Prefixes,
    ) {}
}

/**
 * Wrapper around N3.Parser.parse to convert from callback style to Promise.
 * @param text turtle text to parse.
 * @param source the IRI of the resource to parse.
 */
export const parseTurtle = async (text: string, source?: string): Promise<ParserResult> => {
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
            } else if (quad) {
                store.add(DataFactory.quad(quad.subject, quad.predicate, quad.object));
            } else {
                resolve(new ParserResult(store, parse));
            }
        });
    });
};
