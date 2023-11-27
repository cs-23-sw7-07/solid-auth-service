import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
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
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { getResource } from "./rdf-document";
import { ApplicationRegistrationNotExist } from "./errors/application-registration-not-exist";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";
import { DataRegistryResource } from "./data-registry-container";
import { RegistrySetResource, createRegistriesSet } from "./registry-set-container";
import { AgentRegistryResource } from "./agent-registry-container";
import { ApplicationProfileDocument } from "./profile-documents/application-profile-document";
import { webId2AuthorizationAgentUrl } from "./utils/uri-convert";

export class AuthorizationAgent {
    agentRegistryContainer!: string;
    AuthorizationRegistry_container!: string;
    DataRegistry_container!: string;
    socialAgent: SocialAgent;
    authorizationAgent: ApplicationAgent;

    constructor(
        public pod: string,
        public session: Session,
    ) {
        const webId = session.info.webId!;
        const agent_URI = webId2AuthorizationAgentUrl(webId);
        this.authorizationAgent = new ApplicationAgent(agent_URI);
        this.socialAgent = new SocialAgent(webId);
    }

    async setRegistriesSetContainer() {
        const profile_document: SocialAgentProfileDocument = await getResource(
            SocialAgentProfileDocument,
            this.session.fetch,
            this.socialAgent.webID,
        );

        let registies_set: RegistrySetResource;
        if (profile_document.hasRegistrySet()) {
            registies_set = await profile_document.getRegistrySet(this.session.fetch);
        } else {
            registies_set = await createRegistriesSet(
                this.session.fetch,
                this.pod,
                profile_document,
            );
        }

        this.agentRegistryContainer = registies_set.HasAgentRegistry!;
        this.AuthorizationRegistry_container = registies_set.HasAuthorizationRegistry!;
        this.DataRegistry_container = registies_set.HasDataRegistry!;
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

        const agent_registry = await getResource(
            AgentRegistryResource,
            this.session.fetch,
            this.agentRegistryContainer,
        );
        await agent_registry.addRegistration(
            this.session.fetch,
            approval.agent,
            builder.getAgentRegistration(),
        );
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        const agentRegistrySet = await getResource(
            AgentRegistryResource,
            this.session.fetch,
            this.agentRegistryContainer,
        );
        const profile_document: ApplicationProfileDocument = await getResource(
            ApplicationProfileDocument,
            this.session.fetch,
            webId,
        );
        const type = profile_document.getTypeOfSubject();
        const registration_type = getRegistrationTypes(type);
        const registrations_iri: string[] | undefined =
            agentRegistrySet.getObjectValuesFromPredicate(registration_type);

        if (!registrations_iri) {
            throw new ApplicationRegistrationNotExist(webId);
        }

        const factory = new RdfFactory();
        const rdfs = registrations_iri.map(
            async (iri) => await factory.parse(this.session.fetch, iri),
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
        if (!reg) throw new ApplicationRegistrationNotExist(webId);

        return reg;
    }

    get AllDataRegistrations(): Promise<DataRegistration[]> {
        return getResource(
            DataRegistryResource,
            this.session.fetch,
            this.DataRegistry_container,
        ).then((data_registry) => data_registry.getHasDataRegistrations(this.session.fetch));
    }

    async getDataRegistrations(
        shapeTree: string,
        dataOwner?: SocialAgent,
    ): Promise<DataRegistration[]> {
        const pShapeTree = (reg: DataRegistration) => reg.registeredShapeTree == shapeTree;

        const pDataOwner = (dataReg: DataRegistration) => {
            if (dataOwner) return dataReg.registeredBy == dataOwner;

            return true;
        };
        const dataRegs = await this.AllDataRegistrations;
        return dataRegs.filter((reg) => pShapeTree(reg) && pDataOwner(reg));
    }
}

function getRegistrationTypes(type: string | undefined): string {
    return type === INTEROP + "Application"
        ? INTEROP + "hasApplicationRegistration"
        : INTEROP + "hasSocialAgentRegistration";
}
