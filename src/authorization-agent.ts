import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
import { readResource } from "./utils/modify-pod";
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
import { RDFResource, getContainterResource, getResource } from "./rdf-document";
import { ApplicationRegistrationNotExist } from "./errors/application-registration-not-exist";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";
import { DataRegistryResource } from "./data-registry-container";
import { RegistrySetResource, createRegistriesSet } from "./registry-set-container";
import { AgentRegistryResource } from "./agent-registry-container";
import { ApplicationProfileDocument } from "./profile-documents/application-profile-document";

export class AuthorizationAgent {
    AgentRegistry_container!: string;
    AuthorizationRegistry_container!: string;
    DataRegistry_container!: string;

    constructor(
        public social_agent: SocialAgent,
        public authorization_agent: ApplicationAgent,
        public pod: string,
        public session: Session,
    ) {}

    async setRegistriesSetContainer() {
        const profile_document: SocialAgentProfileDocument =
            await getResource(SocialAgentProfileDocument, this.session.fetch, this.social_agent.webID);

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

        const agent_registry = await getContainterResource(AgentRegistryResource, this.session.fetch,
            this.AgentRegistry_container,
        );
        await agent_registry.addRegistration(
            this.session.fetch,
            approval.agent,
            builder.getAgentRegistration(),
        );
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        const agentRegistrySet = await getContainterResource(AgentRegistryResource, this.session.fetch, this.AgentRegistry_container)
        const profile_document: ApplicationProfileDocument =
            await getResource(ApplicationProfileDocument, this.session.fetch, webId);
        const type = profile_document.getTypeOfSubject();
        const registration_type = getRegistrationTypes(type);
        const registrations_iri: string[] | undefined =
            agentRegistrySet.getObjectValuesFromPredicate(registration_type);

        if (!registrations_iri) {
            throw new ApplicationRegistrationNotExist(webId);
        }

        const factory = new RdfFactory();
        const rdfs = registrations_iri.map(
            async (iri) =>
                await factory.parse(
                    this.session.fetch,
                    iri,
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
        if (!reg) throw new ApplicationRegistrationNotExist(webId);

        return reg;
    }

    getAllDataRegistrations(): Promise<DataRegistration[]> {
        return getContainterResource(DataRegistryResource, this.session.fetch, this.DataRegistry_container).then((data_registry) =>
            data_registry.getHasDataRegistrations(this.session.fetch),
        );
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
        const dataRegs = await this.getAllDataRegistrations();
        return dataRegs.filter((reg) => pShapeTree(reg) && pDataOwner(reg));
    }
}

function getRegistrationTypes(type: string | undefined): string {
    return type === INTEROP + "Application"
        ? INTEROP + "hasApplicationRegistration"
        : INTEROP + "hasSocialAgentRegistration";
}
