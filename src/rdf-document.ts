import { DataFactory, Prefixes, Store } from "n3";
import { DatasetCore } from "@rdfjs/types";
import { Fetch } from "solid-interoperability";
import { readParseResource, updateContainerResource } from "./utils/modify-pod";
const { namedNode } = DataFactory;

export class RDFResource {
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

    protected async updateResource(fetch: Fetch, dataset: DatasetCore) {
        updateContainerResource(fetch, this.uri, dataset);
    }
}

export class RDFResourceContainer extends RDFResource {
    constructor(
        uri: string,
        dataset?: DatasetCore,
        prefixes?: Prefixes,
    ) {
        super(uri, dataset, prefixes);
    }

    protected async updateResource(fetch: Fetch, dataset: DatasetCore) {
        updateContainerResource(fetch, this.uri, dataset);
    }
}

export function getResource<T extends RDFResource>(c: {new (uri: string, dataset?: DatasetCore, prefixes?: Prefixes): T}, fetch: Fetch, uri: string): Promise<T> {
    return readParseResource(fetch, uri)
        .then((result) => new c(uri, result.dataset, result.prefixes));
}

export function getContainterResource<T extends RDFResource>(c: {new (uri: string, dataset?: DatasetCore, prefixes?: Prefixes): T}, fetch: Fetch, uri: string): Promise<T> {
    return readParseResource(fetch, uri)
        .then((result) => new c(uri, result.dataset, result.prefixes));
}