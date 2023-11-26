import { DatasetCore } from "@rdfjs/types";
import { RdfDocument } from "./rdf-document";
import { Prefixes, Store } from "n3";
import N3 from "n3";
import { INTEROP, type_a } from "./namespace";
import { Fetch } from "solid-interoperability";
import { createContainer, updateContainerResource } from "./utils/modify-pod";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";

const { DataFactory } = N3;
const { namedNode } = DataFactory;

export class RegistrySetResource extends RdfDocument {
    constructor(iri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(iri, dataset, prefixes);
    }

    getHasAgentRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAgentRegistry");
    }

    gethasAuthorizationRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationRegistry");
    }

    gethasDataRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasDataRegistry");
    }
}

export async function createRegistriesSet(
    fetch: Fetch,
    pod: string,
    profile_document: SocialAgentProfileDocument,
) {
    const registries_container = pod + "Registries/";
    const AgentRegistry_container = registries_container + "agentregisties/";
    const AuthorizationRegistry_container = registries_container + "accessregisties/";
    const DataRegistry_container = pod + "data/";

    await createContainer(fetch, registries_container);
    await createContainer(fetch, AgentRegistry_container);
    await createContainer(fetch, AuthorizationRegistry_container);
    await createContainer(fetch, DataRegistry_container);

    const registries_store = new Store();
    registries_store.addQuad(
        namedNode(registries_container),
        namedNode(type_a),
        namedNode(INTEROP + "RegistrySet"),
    );
    registries_store.addQuad(
        namedNode(registries_container),
        namedNode(INTEROP + "hasAgentRegistry"),
        namedNode(AgentRegistry_container),
    );
    registries_store.addQuad(
        namedNode(registries_container),
        namedNode(INTEROP + "hasAuthorizationRegistry"),
        namedNode(AuthorizationRegistry_container),
    );
    registries_store.addQuad(
        namedNode(registries_container),
        namedNode(INTEROP + "hasDataRegistry"),
        namedNode(DataRegistry_container),
    );

    await updateContainerResource(fetch, registries_container + ".meta", registries_store).then(
        (_) => profile_document.addhasRegistrySet(registries_container, fetch),
    );

    return new RegistrySetResource(registries_container, registries_store, {});
}
