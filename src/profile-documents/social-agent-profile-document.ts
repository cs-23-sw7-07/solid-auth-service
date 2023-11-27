import N3, { Prefixes } from "n3";
import { DatasetCore } from "@rdfjs/types";
import { RDFResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { Fetch, parseTurtle, serializeTurtle } from "solid-interoperability";
import { RegistrySetResource } from "../registry-set-container";
const { quad, namedNode, defaultGraph } = N3.DataFactory;

const OIDC_ISSUER_PREDICATE = "http://www.w3.org/ns/solid/terms#oidcIssuer";

export class SocialAgentProfileDocument extends RDFResource {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    hasAuthorizationAgent(authorizationUri: string): boolean {
        const authorizationAgents = this.getObjectValuesFromPredicate(
            INTEROP + "hasAuthorizationAgent",
        );
        return (
            authorizationAgents != undefined && authorizationAgents.includes(authorizationUri)
        );
    }

    async addhasAuthorizationAgent(agentUri: string, fetch: Fetch) {
        this.dataset.add(
            quad(
                this.SubjectWebId,
                namedNode(INTEROP + "hasAuthorizationAgent"),
                namedNode(agentUri),
                defaultGraph(),
            ),
        );
        await this.updateProfile(fetch);
    }

    get HasRegistrySet(): boolean {
        const sets = this.getObjectValuesFromPredicate(INTEROP + "hasRegistrySet");
        return sets != undefined;
    }

    getRegistrySet(fetch: Fetch): Promise<RegistrySetResource> {
        const set = this.getObjectValueFromPredicate(INTEROP + "hasRegistrySet")!;
        return fetch(set)
            .then((res) => res.text())
            .then((res) => parseTurtle(res, set))
            .then((parsed) => new RegistrySetResource(set, parsed.dataset));
    }

    async addhasRegistrySet(registriesContainer: string, fetch: Fetch) {
        this.dataset.add(
            quad(
                this.SubjectWebId,
                namedNode(INTEROP + "hasRegistrySet"),
                namedNode(registriesContainer),
                defaultGraph(),
            ),
        );
        await this.updateProfile(fetch);
    }

    private async updateProfile(fetch: Fetch) {
        await fetch(this.uri, {
            method: "PUT",
            body: await serializeTurtle(this.dataset, {
                interop: INTEROP,
            }),
            headers: {
                "Content-Type": "text/turtle",
            },
        });
    }

    get SubjectWebId() {
        for (const quad of this.dataset.match(null, namedNode(OIDC_ISSUER_PREDICATE))) {
            return quad.subject;
        }
        throw new Error("No subject with an OIDC Issuer");
    }
}
