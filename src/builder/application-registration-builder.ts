import { randomUUID } from "crypto";
import { AuthorizationAgent } from "../authorization-agent";
import {
    AccessGrant,
    Agent,
    ApplicationRegistration,
    DataAuthorization,
    DataGrant,
    DataRegistration,
    IDataGrantBuilder,
    SocialAgent,
} from "solid-interoperability";
import { AuthorizationBuilder, AuthorizationResult } from "./authorization-builder";

export class AgentRegistrationBuilder {
    constructor(private authorizationAgent: AuthorizationAgent) {}

    async build(registeredAgent: Agent, authResult: AuthorizationResult[]): Promise<ApplicationRegistration> {
        const agentRegistry = await this.authorizationAgent.registiesSet.getHasAgentRegistry();
        const id = agentRegistry.uri + randomUUID() + "/";

        let accessGrants: AccessGrant[] = [];
        for (const auth of authResult) {
            const grantBuilder = new GrantNeedGroupBuilder(this.authorizationAgent, id);
            const dataGrants = grantBuilder.createDataGrants(auth.dataAuthorizations);
            const accessGrant = auth.accessAuthorization.toAccessGrant(
                this.authorizationAgent.generateId(id),
                await dataGrants,
            );
            accessGrants.push(await accessGrant);
        }

        const reg = await ApplicationRegistration.new(
            id,
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.socialAgent,
            this.authorizationAgent.authorizationAgent,
            registeredAgent,
            accessGrants,
        );
        
        await agentRegistry.addRegistration(reg);
        
        return reg;
    }
}

export class GrantNeedGroupBuilder implements IDataGrantBuilder {
    private dataGrants: Map<DataAuthorization, DataGrant[]> = new Map<
        DataAuthorization,
        DataGrant[]
    >();

    constructor(
        private authorizationAgent: AuthorizationAgent,
        private container: string,
    ) {}

    getAllDataRegistrations(
        registeredShapeTree: string,
        dataOwner?: SocialAgent | undefined,
    ): Promise<DataRegistration[]> {
        return this.authorizationAgent.getDataRegistrations(registeredShapeTree, dataOwner);
    }
    getInheritedDataGrants(auth: DataAuthorization): Promise<DataGrant[]> {
        if (!this.dataGrants.get(auth))
            throw new Error(
                "The corresponding data grants of the inherited data authorization have not been build.",
            );
        return Promise.resolve(this.dataGrants.get(auth)!);
    }

    generateId(): string {
        return this.authorizationAgent.generateId(this.container);
    }

    async createDataGrants(dataAuthorizations: DataAuthorization[]): Promise<DataGrant[]> {
        for (const auth of dataAuthorizations) {
            this.dataGrants.set(auth, await auth.toDataGrant(this));
        }
        return Array.from(this.dataGrants.values()).flat();
    }
}
