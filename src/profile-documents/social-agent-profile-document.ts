import N3, { Prefixes } from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { parseTurtle } from "../utils/turtle-parser";
import { serializeTurtle } from "../utils/turtle-serializer";
import { DatasetCore } from "@rdfjs/types";
import { RDFResource } from "../rdf-document";
import { INTEROP } from "../namespace";
import { Fetch } from "solid-interoperability";
import { RegistrySetResource } from "../registry-set-container";
const { quad, namedNode, defaultGraph } = N3.DataFactory;

const oidcIssuer_PREDICATE = "http://www.w3.org/ns/solid/terms#oidcIssuer";

export class SocialAgentProfileDocument extends RDFResource {
    constructor(webId: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(webId, dataset, prefixes);
    }

    hasAuthorizationAgent(authorization_uri: string): boolean {
        const authorization_agents = this.getObjectValuesFromPredicate(
            INTEROP + "hasAuthorizationAgent",
        );
        return (
            authorization_agents != undefined && authorization_agents.includes(authorization_uri)
        );
    }

    async addhasAuthorizationAgent(agent_URI: string, fetch: Fetch) {
        this.dataset.add(
            quad(
                this.getSubjectWebId(),
                namedNode(INTEROP + "hasAuthorizationAgent"),
                namedNode(agent_URI),
                defaultGraph(),
            ),
        );
        await this.updateProfile(fetch);
    }

    hasRegistrySet(): boolean {
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

    async addhasRegistrySet(registries_container: string, fetch: Fetch) {
        this.dataset.add(
            quad(
                this.getSubjectWebId(),
                namedNode(INTEROP + "hasRegistrySet"),
                namedNode(registries_container),
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

    getSubjectWebId() {
        for (const quad of this.dataset.match(null, namedNode(oidcIssuer_PREDICATE))) {
            return quad.subject;
        }
        throw new Error("No subject with a oidcIssuer");
    }
}
