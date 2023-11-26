import { Fetch } from "solid-interoperability";
import { RDFResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeedGroup } from "../application/access-need-group";
import { DatasetCore } from "@rdfjs/types";
import { DataFactory, Prefixes } from "n3";
import { parseTurtle } from "../utils/turtle-parser";

export class ApplicationProfileDocument extends RDFResource {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    static async getRdfDocument(uri: string, fetch: Fetch): Promise<ApplicationProfileDocument> {
        return fetch(uri)
            .then((res) => res.text())
            .then((res) => parseTurtle(res, uri))
            .then(
                (result) =>
                    new ApplicationProfileDocument(
                        uri,
                        result.dataset.match(DataFactory.namedNode(uri)),
                        result.prefixes,
                    ),
            );
    }

    getApplicationName(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationName");
    }

    getApplicationDescription(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationDescription");
    }

    getApplicationAuthor(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationAuthor");
    }

    getApplicationThumbnail(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "applicationThumbnail");
    }

    async gethasAccessNeedGroup(fetch: Fetch): Promise<AccessNeedGroup[]> {
        const values = this.getObjectValuesFromPredicate(INTEROP + "hasAccessNeedGroup");

        if (!values) return [];

        let groups = [];
        for (const uri of values) {
            groups.push(await AccessNeedGroup.getRdfDocument(uri, fetch));
        }

        return groups;
    }

    getHasAuthorizationCallbackEndpoint(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationCallbackEndpoint");
    }
}
