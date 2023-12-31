import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
import {
    AgentRegistration,
    ApplicationAgent,
    DataRegistration,
    Fetch,
    ProfileDocument,
    RegistrySetResource,
    SocialAgent,
    SocialAgentProfileDocument,
    getResource,
    isApplicationAgent,
    getPod
} from "solid-interoperability";
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { webId2AuthorizationAgentUrl } from "./utils/uri-convert";
import { NoApplicationRegistrationError } from "./errors/application-registration-not-exist";

export class AuthorizationAgent {
    private constructor(
        public session: Session,
        public socialAgent: SocialAgent,
        public authorizationAgent: ApplicationAgent,
        public registiesSet: RegistrySetResource,
    ) {}

    static async new(session: Session): Promise<AuthorizationAgent> {
        const webId = session.info.webId!;
        const agentUri = webId2AuthorizationAgentUrl(webId);
        const pod = await getPod(webId, session.fetch);
        return new AuthorizationAgent(
            session,
            new SocialAgent(webId),
            new ApplicationAgent(agentUri),
            await AuthorizationAgent.setRegistriesSetContainer(webId, pod.toString(), session.fetch),
        );
    }

    private static async setRegistriesSetContainer(
        webId: string,
        pod: string,
        fetch: Fetch,
    ): Promise<RegistrySetResource> {
        const profile: SocialAgentProfileDocument = await getResource(
            SocialAgentProfileDocument,
            fetch,
            webId,
        );

        if (profile.HasRegistrySet) {
            return profile.getRegistrySet();
        } else {
            return RegistrySetResource.createRegistriesSet(fetch, pod, profile, {
                randomID: () => randomUUID(),
            });
        }
    }

    generateId(uri: string) {
        return uri + randomUUID();
    }

    async insertNewAgentToPod(approval: Approval): Promise<void> {
        const authBuilder = new AuthorizationBuilder(
            this,
            approval.agent,
            await this.registiesSet.getHasAuthorizationRegistry(),
            await this.registiesSet.getHasDataRegistry(),
        );
        const authResults = await authBuilder.build(approval);

        const builder = new AgentRegistrationBuilder(this);
        await builder.build(approval.agent, authResults);
    }

    async findAgentRegistrationInPod(webId: string): Promise<AgentRegistration> {
        const agentRegistrySet = await this.registiesSet.getHasAgentRegistry();

        const profileDocument: ProfileDocument = await getResource(
            ProfileDocument,
            this.session.fetch,
            webId,
        );

        const isApp = isApplicationAgent(profileDocument);

        const agentRegistration = isApp
            ? await agentRegistrySet.getHasApplicationRegistration()
            : await agentRegistrySet.getHasSocialAgentRegistration();

        const reg = agentRegistration.find((reg) => reg.RegisteredAgent.WebID == webId);
        if (!reg) throw new NoApplicationRegistrationError(webId);

        return reg;
    }

    get AllDataRegistrations(): Promise<DataRegistration[]> {
        return this.registiesSet
            .getHasDataRegistry()
            .then((dataRegistry) => dataRegistry.getHasDataRegistrations());
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
