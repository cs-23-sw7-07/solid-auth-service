import N3, { DataFactory, Prefixes } from "n3";
import { AccessMode, Fetch, getAccessmode } from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../namespace";
import { DatasetCore } from "@rdfjs/types";
import { parseTurtle } from "../utils/turtle-parser";

export class AccessNeed extends RdfDocument {
    constructor(uri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(uri, dataset, prefixes);
    }

    static async getRdfDocument(
        uri: string,
        fetch: Fetch,
    ): Promise<AccessNeed> {
        return fetch(uri)
            .then((res) => {
                return res.text();
            })
            .then((res) => {
                const a = parseTurtle(res, uri);
                return a;
            })
            .then((result) => {
                const a = new AccessNeed(
                    uri,
                    result.dataset.match(DataFactory.namedNode(uri)),
                    result.prefixes,
                );
                return a;
            });
    }

    getRegisteredShapeTree(): string | undefined {
        return this.getObjectValueFromPredicate(
            INTEROP + "registeredShapeTree",
        );
    }

    getAccessModes(): AccessMode[] {
        const values: string[] | undefined = this.getObjectValuesFromPredicate(
            INTEROP + "accessMode",
        );
        if (values) {
            return values.map((mode) => getAccessmode(mode));
        }
        return [];
    }

    getCreatorAccessModes() {
        const values: string[] | undefined = this.getObjectValuesFromPredicate(
            INTEROP + "creatorAccessMode",
        );
        if (values) {
            return values.map((mode) => getAccessmode(mode));
        }
        return [];
    }

    getAccessNecessity(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "accessNecessity");
    }

    getHasDataInstance(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasDataInstance");
    }

    async getInheritsFromNeed(fetch: Fetch): Promise<AccessNeed | undefined> {
        const inherit_uri: string | undefined =
            this.getObjectValueFromPredicate(INTEROP + "inheritsFromNeed");

        if (inherit_uri) {
            return await AccessNeed.getRdfDocument(inherit_uri, fetch);
        }
        return undefined;
    }
}
