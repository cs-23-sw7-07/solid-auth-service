import N3, { DataFactory, Prefixes } from "n3";
import { AccessMode, Fetch, getAccessmode } from "solid-interoperability";
import { RDFResource, getResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { DatasetCore } from "@rdfjs/types";
import { parseTurtle } from "../utils/turtle-parser";

export class AccessNeed extends RDFResource {
    constructor(uri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(uri, dataset, prefixes);
    }

    getRegisteredShapeTree(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "registeredShapeTree");
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
        const inherit_uri: string | undefined = this.getObjectValueFromPredicate(
            INTEROP + "inheritsFromNeed",
        );

        if (inherit_uri) {
            return await getResource(AccessNeed, fetch, inherit_uri);
        }
        return undefined;
    }
}
