import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { parseTurtle } from "./utils/turtle-parser";
import { serializeTurtle } from "./utils/turtle-serializer";
import { DatasetCore } from "@rdfjs/types";

const { Store, Parser, DataFactory } = N3;
const { quad, namedNode, defaultGraph } = DataFactory

const oidcIssuer_PREDICATE = "http://www.w3.org/ns/solid/terms#oidcIssuer"

export class ProfileDocument {
    constructor(public webId : string, public dataset : DatasetCore) {
        
    }

    static async getProfileDocument(webId: string): Promise<ProfileDocument> {
        return new ProfileDocument(webId, await fetch(webId).then(res => res.text()).then(res => parseTurtle(res)))
    }

    hasAuthorizationAgent(authorization_uri: string): boolean {
        const quads = this.dataset.match(null, namedNode("http://www.w3.org/ns/solid/interop#hasAuthorizationAgent"));
    
        for (const quad of quads) {
            if (quad.object.value == authorization_uri) {
                return true
            }
        }
        return false
    }


    addhasAuthorizationAgent(agent_URI : string) {
        this.dataset.add(quad(this.getSubjectWebId(), namedNode("interop:hasAuthorizationAgent"), namedNode(agent_URI), defaultGraph()))
    }

    hasRegistrySet(): boolean {
        const quads = this.dataset.match(null, namedNode("interop:hasRegistrySet"));
        return quads.size == 1
    }

    addhasRegistrySet(registries_container : string){
        this.dataset.add(quad(this.getSubjectWebId(), namedNode("interop:hasRegistrySet"), namedNode(registries_container), defaultGraph()))
    }

    async updateProfile(session: Session) {
        await session.fetch(this.webId, {
            method: "PUT",
            body: await serializeTurtle(this.dataset, { "interop": "http://www.w3.org/ns/solid/interop#" }),
            headers: {
                "Content-Type": "text/turtle"
            }
        });
    }


    getSubjectWebId() {
        for (const quad of this.dataset.match(null, namedNode(oidcIssuer_PREDICATE))){
            return quad.subject
        }
        throw new Error("No subject with a oidcIssuer")
    }
}