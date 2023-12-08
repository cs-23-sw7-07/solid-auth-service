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
    ProfileDocument
} from "solid-interoperability";
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { getResource } from "./rdf-document";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";
import { DataRegistryResource } from "./data-registry-container";
import { RegistrySetResource, createRegistriesSet } from "./registry-set-container";
import { AgentRegistryResource } from "./agent-registry-container";
import { ApplicationProfileDocument } from "./profile-documents/application-profile-document";
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
        const pod = (await ProfileDocument.fetch(new URL(webId))).Pod;
        return new AuthorizationAgent(session, new SocialAgent(webId), new ApplicationAgent(agentUri), pod.toString())
    }

    async setRegistriesSetContainer() {
        const profileDocument: SocialAgentProfileDocument = await getResource(
            SocialAgentProfileDocument,
            this.session.fetch,
            this.socialAgent.webID,
        );

        let registiesSet: RegistrySetResource;
        if (profileDocument.HasRegistrySet) {
            registiesSet = await profileDocument.getRegistrySet(this.session.fetch);
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
            await authorizationBuilder.storeToPod();
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
            this.session.fetch,
            approval.agent,
            builder.getAgentRegistration(),
        );
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        let agentRegistrySet
        try{
            agentRegistrySet = await getResource(
                AgentRegistryResource,
                this.session.fetch,
                this.agentRegistryContainer,
            );
        } catch (e) {
            throw new Error(`Could not get Agent Registry Set:\n${e}`)
        }
        let profileDocument: ApplicationProfileDocument
        try {
            profileDocument = await getResource(
                ApplicationProfileDocument,
                this.session.fetch,
                webId,
            );
        } catch (e) {
            throw new Error(`Could not get Application Profile Document for WebId:${webId}\n${e}`)
        }


        const type = profileDocument.getTypeOfSubject();

        let registrationsIri: string[] | undefined
        try {
            const registrationType = getRegistrationTypes(type);
            registrationsIri = agentRegistrySet.getObjectValuesFromPredicate(registrationType);
        } catch (e) {
            throw new Error(`Error getting registrations IRI:\n${e}`)
        }

        if (!registrationsIri) {
            console.error("Registrations IRIs were not found.")
            throw new NoApplicationRegistrationError(webId);
        }

        let rdfs = []
        try {
            const factory = new RdfFactory();
            for (const iri of registrationsIri){
                rdfs.push(await factory.parse(this.session.fetch, iri))
            }
        } catch (e){
            throw new Error(`Could not fetch and parse Registration IRIs\n${e}`)
        }

        let agentRegistration = [];
        try {
            if (type == INTEROP + "Application") {
                agentRegistration = rdfs.map((rdf) =>
                    ApplicationRegistration.makeApplicationRegistration(rdf),
                );
            } else {
                throw new NotImplementedYet(
                    "Have not implmented a makeSocialAgentRegistration method on SocialAgentRegistration",
                );
            }
        } catch (e) {
            console.error("No Agent Registrations found.")
            throw new NoApplicationRegistrationError(webId)
        }
        const reg = await agentRegistration.find(
            async (reg) => (await reg).registeredAgent.webID == webId,
        );
        if (!reg) throw new NoApplicationRegistrationError(webId);

        return reg;
    }

    get AllDataRegistrations(): Promise<DataRegistration[]> {
        return getResource(
            DataRegistryResource,
            this.session.fetch,
            this.dataRegistryContainer,
        ).then((dataRegistry) => dataRegistry.getHasDataRegistrations(this.session.fetch));
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
