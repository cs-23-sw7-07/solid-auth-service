import { DatasetCore } from "@rdfjs/types";
import { RDFResourceContainer } from "./rdf-document";
import { Prefixes, Store } from "n3";
import N3 from "n3";
import { INTEROP } from "./namespace";
import { Agent, AgentRegistration, ApplicationAgent, Fetch } from "solid-interoperability";

const { DataFactory } = N3;
const { namedNode } = DataFactory;

export class AgentRegistryResource extends RDFResourceContainer {
    constructor(iri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(iri, dataset, prefixes);
    }

    get HasSocialAgentRegistration(): string[] | undefined {
        return this.getObjectValuesFromPredicate(INTEROP + "hasSocialAgentRegistration");
    }

    get HasApplicationRegistration(): string[] | undefined {
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

    get HasDataRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasDataRegistry");
    }
}
