import { DataFactory, Prefixes, Store } from "n3";
import { DatasetCore } from "@rdfjs/types";
import { Fetch } from "solid-interoperability";
import { parseTurtle } from "./utils/turtle-parser";
const { namedNode } = DataFactory;

export class RdfDocument {
    dataset: DatasetCore = new Store();
    prefixes: Prefixes = {};

    constructor(
        public uri: string,
        dataset?: DatasetCore,
        prefixes?: Prefixes,
    ) {
        if (dataset) this.dataset = dataset;
        if (prefixes) this.prefixes = prefixes;
    }

    static getRdfDocument(uri: string, fetch: Fetch): Promise<RdfDocument> {
        return fetch(uri)
            .then((res) => res.text())
            .then((res) => parseTurtle(res, uri))
            .then((result) => new RdfDocument(uri, result.dataset, result.prefixes));
    }

    getTypeOfSubject(): string | undefined {
        return this.getObjectValueFromPredicate("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    }

    getObjectValueFromPredicate(predicate: string): string | undefined {
        const values = this.getObjectValuesFromPredicate(predicate);
        if (values && values.length == 1) {
            return values[0];
        }
        return undefined;
    }

    getObjectValuesFromPredicate(predicate: string): string[] | undefined {
        const quads = this.dataset.match(namedNode(this.uri), namedNode(predicate));
        let values: string[] = [];
        for (const quad of quads) {
            values.push(quad.object.value);
        }

        return values.length != 0 ? values : undefined;
    }
}
