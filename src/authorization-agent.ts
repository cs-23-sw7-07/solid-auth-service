import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { SocialAgent } from "./agent";
import { createContainer, type_a, updateContainer } from "./utils/modify-pod";
import { DatasetCore } from "@rdfjs/types";
import { ProfileDocument } from "./profile-document";
const { Store, Parser, DataFactory } = N3;
const { quad, namedNode } = DataFactory

export class AuthorizationAgent {
    constructor(public social_agent : SocialAgent,
                public agent_URI : string ,
                public pod : string, 
                public session : Session) {

    }

    async createRegistriesSet() {
        const registries_container = this.pod + "Registries/"
        const AgentRegistry_container = this.pod + "Registries/agentregisties/"
        const AuthorizationRegistry_container = this.pod + "Registries/accessregisties/"
        const DataRegistry_container = this.pod + "data/"
        createContainer(this.session, registries_container)
        createContainer(this.session, AgentRegistry_container)
        createContainer(this.session, AuthorizationRegistry_container)
        createContainer(this.session, DataRegistry_container)
        
        const profile_document: ProfileDocument = await ProfileDocument.getProfileDocument(this.social_agent.webID)
        await profile_document.updateProfile(this.session)

        const registries_store = new Store();
        registries_store.addQuad(namedNode(registries_container), type_a, namedNode("interop:RegistrySet"))
        registries_store.addQuad(namedNode(registries_container), namedNode("interop:hasAgentRegistry"), namedNode(AgentRegistry_container))
        registries_store.addQuad(namedNode(registries_container), namedNode("interop:hasAuthorizationRegistry"), namedNode(AuthorizationRegistry_container))
        registries_store.addQuad(namedNode(registries_container), namedNode("interop:hasDataRegistry"), namedNode(DataRegistry_container))

        await updateContainer(this.session, registries_container + ".meta", registries_store)
    }
    
}