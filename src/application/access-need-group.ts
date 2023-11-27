import { AccessAuthorization, Agent, DataAuthorization, Fetch } from "solid-interoperability";
import { RDFResource, getResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeed } from "./access-need";
import { AuthorizationAgent } from "../authorization-agent";
import { parseTurtle } from "../utils/turtle-parser";
import { DatasetCore } from "@rdfjs/types";
import { DataFactory, Prefixes } from "n3";

export class AccessNeedGroup extends RDFResource {
    constructor(uri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(uri, dataset, prefixes);
    }

    gethasAccessDescriptionSet(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasAccessDescriptionSet");
    }

    getAccessNecessity(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "accessNecessity");
    }

    getAccessScenario(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "accessScenario");
    }

    getAuthenticatesAs(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "authenticatesAs");
    }

    async getHasAccessNeed(fetch: Fetch): Promise<AccessNeed[]> {
        const need_uris = this.getObjectValuesFromPredicate(INTEROP + "hasAccessNeed");
        if (!need_uris) return [];

        let needs: AccessNeed[] = [];
        for (const uri of need_uris) {
            needs.push(await getResource(AccessNeed, fetch, uri));
        }

        return needs;
    }

    getReplaces(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "replaces");
    }

    toAccessAuthorization(
        id: string,
        authorization_agent: AuthorizationAgent,
        grantee: Agent,
        data_authorizations: DataAuthorization[],
    ): AccessAuthorization {
        return new AccessAuthorization(
            id,
            authorization_agent.social_agent,
            authorization_agent.authorization_agent,
            new Date(),
            grantee,
            this.uri,
            data_authorizations,
        );
    }
}
