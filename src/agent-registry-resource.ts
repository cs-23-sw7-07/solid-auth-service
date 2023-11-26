import { DatasetCore } from "@rdfjs/types";
import { RdfDocument } from "./rdf-document";
import { Prefixes, Store } from "n3";
import N3 from "n3";
import { INTEROP } from "./namespace";
import { Agent, AgentRegistration, ApplicationAgent, Fetch } from "solid-interoperability";
import { updateContainerResource } from "./utils/modify-pod";
import { parseTurtle } from "./utils/turtle-parser";

const { DataFactory } = N3;
const { namedNode } = DataFactory;

export class AgentRegistryResource extends RdfDocument {
    constructor(iri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(iri, dataset, prefixes);
    }

    static async getResource(uri: string): Promise<AgentRegistryResource> {
        return fetch(uri)
            .then((res) => res.text())
            .then((res) => parseTurtle(res, uri))
            .then((parse) => new AgentRegistryResource(uri, parse.dataset, parse.prefixes));
    }

    getHasSocialAgentRegistration(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasSocialAgentRegistration");
    }

    getHasApplicationRegistration(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasApplicationRegistration");
    }

    async addRegistration(fetch: Fetch, agent: Agent, registration: AgentRegistration) {
        const predicate =
            agent instanceof ApplicationAgent
                ? INTEROP + "hasApplicationRegistration"
                : INTEROP + "hasSocialAgentRegistration";
        const store = new Store();
        store.addQuad(namedNode(this.uri), namedNode(predicate), namedNode(registration.id));
        await this.updateResource(fetch, store).then((_) => {
            for (const quad of store.match()) {
                this.dataset.add(quad);
            }
        });
    }

    gethasDataRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasDataRegistry");
    }

    private async updateResource(fetch: Fetch, dataset: DatasetCore) {
        updateContainerResource(fetch, this.uri + ".meta", dataset);
    }
}
