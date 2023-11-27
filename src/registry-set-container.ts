import { DatasetCore } from "@rdfjs/types";
import { RDFResourceContainer } from "./rdf-document";
import { Prefixes, Store } from "n3";
import N3 from "n3";
import { INTEROP, TYPE_A } from "./namespace";
import { Fetch } from "solid-interoperability";
import { createContainer, updateContainerResource } from "./utils/modify-pod";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";

const { DataFactory } = N3;
const { namedNode } = DataFactory;

export class RegistrySetResource extends RDFResourceContainer {
    constructor(iri: string, dataset?: DatasetCore, prefixes?: Prefixes) {
        super(iri, dataset, prefixes);
    }

    get HasAgentRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAgentRegistry");
    }

    get HasAuthorizationRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationRegistry");
    }

    get HasDataRegistry(): string | undefined {
        return this.getObjectValueFromPredicate(INTEROP + "hasDataRegistry");
    }
}

export async function createRegistriesSet(
    fetch: Fetch,
    pod: string,
    profileDocument: SocialAgentProfileDocument,
) {
    const registriesContainer = pod + "Registries/";
    const agentRegistryContainer = registriesContainer + "agentregisties/";
    const authorizationRegistryContainer = registriesContainer + "accessregisties/";
    const dataRegistryContainer = pod + "data/";

    await createContainer(fetch, registriesContainer);
    await createContainer(fetch, agentRegistryContainer);
    await createContainer(fetch, authorizationRegistryContainer);
    await createContainer(fetch, dataRegistryContainer);

    const registriesStore = new Store();
    registriesStore.addQuad(
        namedNode(registriesContainer),
        namedNode(TYPE_A),
        namedNode(INTEROP + "RegistrySet"),
    );
    registriesStore.addQuad(
        namedNode(registriesContainer),
        namedNode(INTEROP + "hasAgentRegistry"),
        namedNode(agentRegistryContainer),
    );
    registriesStore.addQuad(
        namedNode(registriesContainer),
        namedNode(INTEROP + "hasAuthorizationRegistry"),
        namedNode(authorizationRegistryContainer),
    );
    registriesStore.addQuad(
        namedNode(registriesContainer),
        namedNode(INTEROP + "hasDataRegistry"),
        namedNode(dataRegistryContainer),
    );

    await updateContainerResource(fetch, registriesContainer, registriesStore).then((_) =>
        profileDocument.addhasRegistrySet(registriesContainer, fetch),
    );

    return new RegistrySetResource(registriesContainer, registriesStore, {});
}
