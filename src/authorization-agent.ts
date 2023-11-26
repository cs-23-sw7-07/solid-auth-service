import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
import {
    readResource,
    updateContainerResource,
} from "./utils/modify-pod";
import { INTEROP } from "./namespace";
import {
    AgentRegistration,
    ApplicationAgent,
    ApplicationRegistration,
    DataRegistration,
    NotImplementedYet,
    RdfFactory,
    SocialAgent,
} from "solid-interoperability";
import { parseTurtle } from "./utils/turtle-parser";
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { RdfDocument } from "./rdf-document";
import { ApplicationRegistrationNotExist } from "./errors/application-registration-not-exist";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";
import { DataRegistryResource } from "./data-registry-resource";
import { RegistrySetResource, createRegistriesSet } from "./registry-set-resource";

const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;

export class AuthorizationAgent {
    AgentRegistry_container!: string;
    AuthorizationRegistry_container!: string;
    DataRegistry_container!: string;

    constructor(
        public social_agent: SocialAgent,
        public authorization_agent: ApplicationAgent,
        public pod: string,
        public session: Session,
    ) { }

    async setRegistriesSetContainer() {
        const profile_document: SocialAgentProfileDocument =
            await SocialAgentProfileDocument.getProfileDocument(
                this.social_agent.webID,
            );
        
        let registies_set: RegistrySetResource
        if (profile_document.hasRegistrySet()) {
            registies_set = await profile_document.getRegistrySet(
                this.session.fetch,
            );
        } else {
            registies_set = await createRegistriesSet(this.session.fetch, this.pod, profile_document);
        }

        this.AgentRegistry_container = registies_set.getHasAgentRegistry()!;
        this.AuthorizationRegistry_container = registies_set.gethasAuthorizationRegistry()!;
        this.DataRegistry_container = registies_set.gethasDataRegistry()!;
    }

    generateId(uri: string) {
        return uri + randomUUID();
    }

    async insertNewAgentToPod(approval: Approval) {
        let authBuilders: AuthorizationBuilder[] = [];
        for (const [needGroup, scopes] of approval.access) {
            const authBuilder = new AuthorizationBuilder(this, approval.agent);
            for (const scope of scopes) {
                await authBuilder.createDataAuthorization(scope);
            }
            await authBuilder.createAccessAuthorization(needGroup);
            authBuilders.push(authBuilder);
        }

        for (const authorizationBuilder of authBuilders) {
            await authorizationBuilder.storeToPod();
        }

        const builder = new AgentRegistrationBuilder(this);
        await builder.build(approval.agent, authBuilders);
        await builder.storeToPod();

        const predicate =
            approval.agent instanceof ApplicationAgent
                ? INTEROP + "hasApplicationRegistration"
                : INTEROP + "hasSocialAgentRegistration";
        const AgentRegistry_store = new Store();
        AgentRegistry_store.addQuad(
            namedNode(this.AgentRegistry_container),
            namedNode(predicate),
            namedNode(builder.getAgentRegistration().id),
        );
        await updateContainerResource(
            this.session.fetch,
            this.AgentRegistry_container + ".meta",
            AgentRegistry_store,
        );
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        const turtle = await readResource(this.session, this.AgentRegistry_container);
        const parse_result = await parseTurtle(turtle, this.AgentRegistry_container);
        const agentRegistrySet = new RdfDocument(
            this.AgentRegistry_container,
            parse_result.dataset,
            parse_result.prefixes,
        );
        const type = agentRegistrySet.getTypeOfSubject();
        const registration_type = getRegistrationTypes(type);
        const registrations_iri: string[] | undefined = agentRegistrySet.getObjectValuesFromPredicate(registration_type);

        if (!registrations_iri) {
            throw new ApplicationRegistrationNotExist();
        }

        const factory = new RdfFactory();
        const rdfs = registrations_iri.map(
            async (iri) =>
                await factory.parse(
                    this.session.fetch,
                    await readResource(this.session, iri),
                ),
        );

        let agent_registration = [];
        if (type == INTEROP + "Application") {
            agent_registration = rdfs.map(async (rdf) =>
                ApplicationRegistration.makeApplicationRegistration(await rdf),
            );
        } else {
            throw new NotImplementedYet(
                "Have not implmented a makeSocialAgentRegistration method on SocialAgentRegistration",
            );
        }

        const reg = await agent_registration.find(
            async (reg) => (await reg).registeredAgent.webID == webId,
        );
        if (!reg)
            throw new ApplicationRegistrationNotExist();

        return reg;
    }

    getAllDataRegistrations(): Promise<DataRegistration[]> {
        return DataRegistryResource.getResource(this.DataRegistry_container)
            .then(data_registry => data_registry.getHasDataRegistrations(this.session.fetch))
    }

    async getDataRegistrations(
        shapeTree: string,
        dataOwner?: SocialAgent,
    ): Promise<DataRegistration[]> {
        const pShapeTree = (reg: DataRegistration) =>
            reg.registeredShapeTree == shapeTree;

        const pDataOwner = (dataReg: DataRegistration) => {
            if (dataOwner)
                return dataReg.registeredBy == dataOwner;

            return true;
        };
        const dataRegs = await this.getAllDataRegistrations();
        return dataRegs.filter((reg) => pShapeTree(reg) && pDataOwner(reg));
    }
}

function getRegistrationTypes(type: string | undefined): string {
    return type === INTEROP + "Application" ? INTEROP + "hasApplicationRegistration" : INTEROP + "hasSocialAgentRegistration";
}
