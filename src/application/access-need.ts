import { Prefixes } from "n3";
import { AccessMode, Fetch, getAccessmode } from "solid-interoperability";
import { RDFResource, getResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { DatasetCore } from "@rdfjs/types";

export class AccessNeed extends RDFResource {
    constructor(uri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(uri, dataset, prefixes);
    }

    get RegisteredShapeTree(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "registeredShapeTree");
    }

    get AccessModes(): AccessMode[] {
        const values: string[] | undefined = this.getObjectValuesFromPredicate(
            INTEROP + "accessMode",
        );
        if (values) {
            return values.map((mode) => getAccessmode(mode));
        }
        return [];
    }

    get CreatorAccessModes() {
        const values: string[] | undefined = this.getObjectValuesFromPredicate(
            INTEROP + "creatorAccessMode",
        );
        if (values) {
            return values.map((mode) => getAccessmode(mode));
        }
        return [];
    }

    get AccessNecessity(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "accessNecessity");
    }

    get HasDataInstance(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasDataInstance");
    }

    async getInheritsFromNeed(fetch: Fetch): Promise<AccessNeed | undefined> {
        const inheritUri: string | undefined = this.getObjectValueFromPredicate(
            INTEROP + "inheritsFromNeed",
        );

        if (inheritUri) {
            return await getResource(AccessNeed, fetch, inheritUri);
        }
        return undefined;
    }
}
