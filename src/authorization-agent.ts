import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
import { INTEROP } from "./namespace";
import {
    AgentRegistration,
    AgentRegistryResource,
    ApplicationAgent,
    ApplicationProfileDocument,
    ApplicationRegistration,
    DataRegistration,
    DataRegistryResource,
    RegistrySetResource,
    SocialAgent,
    SocialAgentProfileDocument,
    SocialAgentRegistration,
    createRegistriesSet,
    getResource,
} from "solid-interoperability";
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { webId2AuthorizationAgentUrl } from "./utils/uri-convert";
import { getPodUrlAll } from "@inrupt/solid-client";
import { NoApplicationRegistrationError } from "./errors/application-registration-not-exist";

export class AuthorizationAgent {
    agentRegistryContainer!: string;
    authorizationRegistryContainer!: string;
    dataRegistryContainer!: string;
    
    private constructor(
        public session: Session,
        public socialAgent: SocialAgent,
        public authorizationAgent: ApplicationAgent,
        public pod: string
    ) { }

    static async new(session: Session): Promise<AuthorizationAgent> {
        const webId = session.info.webId!;
        const agentUri = webId2AuthorizationAgentUrl(webId);
        const pods = await getPodUrlAll(webId, { fetch: session.fetch });
        return new AuthorizationAgent(session, new SocialAgent(webId), new ApplicationAgent(agentUri), pods[0])
    }

    async setRegistriesSetContainer() {
        const profileDocument: SocialAgentProfileDocument = await getResource(
            SocialAgentProfileDocument,
            this.session.fetch,
            this.socialAgent.webID,
        );

        let registiesSet: RegistrySetResource;
        if (profileDocument.HasRegistrySet) {
            registiesSet = await profileDocument.getRegistrySet();
        } else {
            registiesSet = await createRegistriesSet(
                this.session.fetch,
                this.pod,
                profileDocument,
            );
        }

        this.agentRegistryContainer = registiesSet.HasAgentRegistry!;
        this.authorizationRegistryContainer = registiesSet.HasAuthorizationRegistry!;
        this.dataRegistryContainer = registiesSet.HasDataRegistry!;
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
            await authorizationBuilder.updateParentContainerMetaData();
        }

        const builder = new AgentRegistrationBuilder(this);
        await builder.build(approval.agent, authBuilders);
        await builder.storeToPod();

        const agentRegistry = await getResource(
            AgentRegistryResource,
            this.session.fetch,
            this.agentRegistryContainer,
        );
        await agentRegistry.addRegistration(
            builder.getAgentRegistration(),
        );
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        const agentRegistrySet = await getResource(
            AgentRegistryResource,
            this.session.fetch,
            this.agentRegistryContainer,
        );
        const profileDocument: ApplicationProfileDocument = await getResource(
            ApplicationProfileDocument,
            this.session.fetch,
            webId,
        );
        
        const type = profileDocument.getTypeOfSubject();
        const isApp = isApplicationAgent(type);
        const registrationType = isApp
            ? INTEROP + "hasApplicationRegistration"
            : INTEROP + "hasSocialAgentRegistration";
        const registrationsIri: string[] | undefined =
            agentRegistrySet.getObjectValuesFromPredicate(registrationType); // TODO: Should only take type of agent as parameter, not predicate
            
        if (!registrationsIri) {
            throw new NoApplicationRegistrationError(webId);
        }

        let agentRegistration = registrationsIri.map(async (iri) => {
            let ActualAgentType = isApp ? ApplicationRegistration : SocialAgentRegistration;
            return await getResource(ActualAgentType, this.session.fetch, iri)
        })

        const reg = await agentRegistration.find(
            async (reg) => (await reg).RegisteredAgent.webID == webId,
        );
        if (!reg) throw new NoApplicationRegistrationError(webId);

        return reg;
    }

    get AllDataRegistrations(): Promise<DataRegistration[]> {
        return getResource(
            DataRegistryResource,
            this.session.fetch,
            this.dataRegistryContainer,
        ).then((dataRegistry) => dataRegistry.getHasDataRegistrations());
    }

    async getDataRegistrations(
        shapeTree: string,
        dataOwner?: SocialAgent,
    ): Promise<DataRegistration[]> {
        const pShapeTree = (reg: DataRegistration) => reg.RegisteredShapeTree == shapeTree;

        const pDataOwner = (dataReg: DataRegistration) => {
            if (dataOwner) return dataReg.RegisteredBy == dataOwner;

            return true;
        };
        const dataRegs = await this.AllDataRegistrations;
        return dataRegs.filter((reg) => pShapeTree(reg) && pDataOwner(reg));
    }
}

function isApplicationAgent(types: string[] | undefined): boolean {
    return types!.includes(INTEROP + "Application"); // Should not use ! here but do error handling
}
