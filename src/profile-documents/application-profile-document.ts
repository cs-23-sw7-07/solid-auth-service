import { Fetch } from "solid-interoperability";
import { RDFResource, getResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeedGroup } from "../application/access-need-group";
import { DatasetCore } from "@rdfjs/types";
import { Prefixes } from "n3";

export class ApplicationProfileDocument extends RDFResource {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    get ApplicationName(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationName");
    }

    get ApplicationDescription(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationDescription");
    }

    get ApplicationAuthor(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationAuthor");
    }

    get ApplicationThumbnail(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationThumbnail");
    }

    async gethasAccessNeedGroup(fetch: Fetch): Promise<AccessNeedGroup[]> {
        const values = this.getObjectValuesFromPredicate(INTEROP + "hasAccessNeedGroup");

        if (!values) return [];

        let groups = [];
        for (const uri of values) {
            groups.push(await getResource(AccessNeedGroup, fetch, uri));
        }

        return groups;
    }

    get HasAuthorizationCallbackEndpoint(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationCallbackEndpoint");
    }
}
