import { AccessAuthorization, Agent, DataAuthorization, Fetch } from "solid-interoperability";
import { RDFResource, getResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeed } from "./access-need";
import { AuthorizationAgent } from "../authorization-agent";
import { DatasetCore } from "@rdfjs/types";
import { Prefixes } from "n3";

export class AccessNeedGroup extends RDFResource {
    constructor(uri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(uri, dataset, prefixes);
    }

    get HasAccessDescriptionSet(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasAccessDescriptionSet");
    }

    get AccessNecessity(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "accessNecessity");
    }

    get AccessScenario(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "accessScenario");
    }

    get AuthenticatesAs(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "authenticatesAs");
    }

    async getHasAccessNeed(fetch: Fetch): Promise<AccessNeed[]> {
        const needUris = this.getObjectValuesFromPredicate(INTEROP + "hasAccessNeed");
        if (!needUris) return [];

        let needs: AccessNeed[] = [];
        for (const uri of needUris) {
            needs.push(await getResource(AccessNeed, fetch, uri));
        }

        return needs;
    }

    getReplaces(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "replaces");
    }

    toAccessAuthorization(
        id: string,
        authorizationAgent: AuthorizationAgent,
        grantee: Agent,
        dataAuthorizations: DataAuthorization[],
    ): AccessAuthorization {
        return new AccessAuthorization(
            id,
            authorizationAgent.socialAgent,
            authorizationAgent.authorizationAgent,
            new Date(),
            grantee,
            this.uri,
            dataAuthorizations,
        );
    }
}
