import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { createContainer, insertTurtleResource, readResource, type_a, updateContainerResource } from "./utils/modify-pod";
import { DatasetCore } from "@rdfjs/types";
import { ProfileDocument } from "./profile-document";
import { AccessAuthorization, AccessGrant, AccessMode, Agent, AgentRegistration, ApplicationAgent, ApplicationRegistration, DataAuthorization, DataRegistration, GrantScope, SocialAgent } from "solid-interoperability";
import { RdfFactory } from "solid-interoperability";
import { parseTurtle } from "./utils/turtle-parser";
import { randomUUID } from "crypto";
import { ApplicationProfileDocument } from "./RDF/application/application-profile-document";
import { AccessNeed } from "./RDF/application/access-need";
import { serializeTurtle } from "./utils/turtle-serializer";
import { createDataAuthorizations } from "./utils/data-authorization-util";
import { access } from "fs";
import { Approval } from "./RDF/application/approval";
import { DataAuthorizationBuilder } from "./RDF/builder/data-authorizations-builder";
import { AccessAuthorizationBuilder } from "./RDF/builder/access-authorization-builder";
import { AuthorizationBuilder } from "./RDF/builder/authorization-builder";

const { Store, DataFactory } = N3;
const { namedNode } = DataFactory

export class AuthorizationAgent {
    registries_container: string;
    AgentRegistry_container: string;
    AuthorizationRegistry_container: string;
    DataRegistry_container: string;

    constructor(public social_agent: SocialAgent,
        public authorization_agent: ApplicationAgent,
        public pod: string,
        public session: Session) {

        this.registries_container = this.pod + "Registries/"
        this.AgentRegistry_container = this.pod + "Registries/agentregisties/"
        this.AuthorizationRegistry_container = this.pod + "Registries/accessregisties/"
        this.DataRegistry_container = this.pod + "data/"
    }

    async createRegistriesSet() {
        createContainer(this.session, this.registries_container)
        createContainer(this.session, this.AgentRegistry_container)
        createContainer(this.session, this.AuthorizationRegistry_container)
        createContainer(this.session, this.DataRegistry_container)

        const profile_document: ProfileDocument = await ProfileDocument.getProfileDocument(this.social_agent.webID)
        await profile_document.updateProfile(this.session)

        const registries_store = new Store();
        registries_store.addQuad(namedNode(this.registries_container), type_a, namedNode("interop:RegistrySet"))
        registries_store.addQuad(namedNode(this.registries_container), namedNode("interop:hasAgentRegistry"), namedNode(this.AgentRegistry_container))
        registries_store.addQuad(namedNode(this.registries_container), namedNode("interop:hasAuthorizationRegistry"), namedNode(this.AuthorizationRegistry_container))
        registries_store.addQuad(namedNode(this.registries_container), namedNode("interop:hasDataRegistry"), namedNode(this.DataRegistry_container))

        await updateContainerResource(this.session, this.registries_container + ".meta", registries_store)

        // console.log("INSERT DOCUMENT")
        // await insertTurtleResource(this.session, this.registries_container + "testtesttestabbbb", await serializeTurtle(profile_document.dataset, { "interop": "http://www.w3.org/ns/solid/interop#" }))
        // console.log("INSERTED DOCUMENT")
        // console.log("READ DOCUMENT")
        // console.log(await readContainer(this.session, this.registries_container + "testtesttestabbbb"))
    }

    newId(uri: string) {
        return uri + randomUUID()
    }

    async newDataAuthorization(
        grantee: Agent,
        registeredShapeTree: string,
        accessMode: AccessMode[],
        scopeOfAuthorization: GrantScope,
        satisfiesAccessNeed: string,
        hasDataInstanceIRIs?: string[],
        creatorAccessMode?: AccessMode[],
        inheritsFromAuthorization?: DataAuthorization) {
        const data_registration = await this.findDataRegistration(registeredShapeTree)
        return new DataAuthorization(
            this.newId(this.AuthorizationRegistry_container),
            this.social_agent,
            grantee,
            registeredShapeTree,
            data_registration,
            accessMode,
            scopeOfAuthorization,
            satisfiesAccessNeed,
            hasDataInstanceIRIs,
            creatorAccessMode,
            inheritsFromAuthorization)
    }

    async newAccessAuthorization(registeredAgent: ApplicationAgent, hasAccessNeedGroup: string, data_authorizations: DataAuthorization[]) {
        return new AccessAuthorization(this.newId(this.AuthorizationRegistry_container), this.social_agent, this.authorization_agent, new Date(), registeredAgent, hasAccessNeedGroup, data_authorizations)
    }

    async newApplication(approval: Approval) {
        // const applicationProfileDocument = await ApplicationProfileDocument.getRdfDocument(registeredAgentId, this.session.fetch);
        // const accessNeedGroups = await applicationProfileDocument.gethasAccessNeedGroup(this.session.fetch);

        let authorizationBuilders: AuthorizationBuilder[] = []

        approval.access.forEach((dataAccessScopes, needGroup) => {
            const authorizationBuilder = new AuthorizationBuilder(this, new ApplicationAgent(approval.applicationProfileDocument.uri))
            dataAccessScopes.forEach(dataAccessScope => {
                authorizationBuilder.createDataAuthorization(dataAccessScope)
            });
            authorizationBuilder.createAccessAuthorization(needGroup)
        });

        for (const authorizationBuilder of authorizationBuilders) {
            authorizationBuilder.getCreatedDataAuthorizations().forEach(async data_authoriza => {
                const turtle = await new RdfFactory().create(data_authoriza) as string // Error handling
                insertTurtleResource(this.session, data_authoriza.id, turtle)
            })

            const access_authoriza = authorizationBuilder.getCreatedAccessAuthorization();
            const turtle = await new RdfFactory().create(access_authoriza) as string // Error handling
            insertTurtleResource(this.session, access_authoriza.id, turtle)

        }




    }

    async addApplicationRegistration(registeredAgent: ApplicationAgent, hasAccessGrant: AccessGrant) {
        const registration = new ApplicationRegistration(this.AgentRegistry_container + randomUUID() + "/", this.social_agent, this.authorization_agent, new Date(), new Date(), registeredAgent, hasAccessGrant);
        createContainer(this.session, registration.id)
        const turtle = await new RdfFactory().create(registration) as string
        updateContainerResource(this.session, registration.id + ".meta", await parseTurtle(turtle))
    }

    async addAccessAuthorization(registeredAgent: ApplicationAgent, hasAccessGrant: AccessGrant) {
        const registration = new ApplicationRegistration(this.AgentRegistry_container + randomUUID() + "/", this.social_agent, this.authorization_agent, new Date(), new Date(), registeredAgent, hasAccessGrant);
        createContainer(this.session, registration.id)
        const turtle = await new RdfFactory().create(registration) as string
        updateContainerResource(this.session, registration.id + ".meta", await parseTurtle(turtle))
    }

    findApplicationRegistration(client_id: string): AgentRegistration | undefined {
        throw new ApplicationRegistrationNotExist()
    }

    async getAllDataRegistrations(): Promise<DataRegistration[]> {
        const dataset = await readResource(this.session, this.DataRegistry_container).then(parseTurtle)
        let registration: DataRegistration[] = []
        const rdf_creater = new RdfFactory()
        for (const quad of dataset.match(null, namedNode("http://www.w3.org/ns/solid/interop#hasDataRegistration"))) {
            registration.push(await rdf_creater.parse(this.session.fetch, quad.object.value)
                .then(DataRegistration.makeDataRegistration)
                .catch(e => { throw e }))
        }

        return registration
    }

    findDataRegistration(shapeTree: string): Promise<DataRegistration> {
        return this.getAllDataRegistrations().then(regs => {
            for (const reg of regs) {
                if (reg.registeredShapeTree == shapeTree) {
                    return reg
                }
            }
            throw new Error("No dataregistration")
        })
    }

    createAccessAuthorization(
        applicationProfile: ApplicationProfileDocument,
        scopeOfGrant: GrantScope,
        hasAccessNeedGroup: string,
        dataAuthorizations: DataAuthorization[]
    ): AccessAuthorization {
        const webId = applicationProfile.webId;



        return new AccessAuthorization(
            this.AuthorizationRegistry_container + this.newId(webId),
            this.social_agent,
            this.authorization_agent,
            new Date(),
            new ApplicationAgent(webId),
            hasAccessNeedGroup,
            dataAuthorizations);
    }

    getDataRegistration(shapeTree: string): DataRegistration {
        throw new Error("Method not implemented.");
    }
}

export class ApplicationRegistrationNotExist extends Error {

}
