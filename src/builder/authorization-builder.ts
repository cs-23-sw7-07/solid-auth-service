import {
    AccessAuthorization,
    AccessNeedGroup,
    Agent,
    AuthorizationRegistryResource,
    DataAuthorization,
    DataRegistration,
    DataRegistryResource,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import { Approval } from "../application/approval";

export class AuthorizationResult {
    constructor(
        public accessAuthorization: AccessAuthorization,
        public dataAuthorizations: DataAuthorization[],
    ) {}
}

export class AuthorizationBuilder {
    private dataAuthorizations: Map<string, DataAuthorization> = new Map<
        string,
        DataAuthorization
    >();

    constructor(
        public authorizationAgent: AuthorizationAgent,
        public grantee: Agent,
        private authorizationRegistry: AuthorizationRegistryResource,
        private dataRegistry: DataRegistryResource,
    ) {}

    generateId(): string {
        return this.authorizationAgent.generateId(this.authorizationRegistry.uri);
    }
    async build(approval: Approval): Promise<AuthorizationResult[]> {
        const result: AuthorizationResult[] = [];
        for (const [needGroup, scopes] of approval.access) {
            const dataAuth = await this.createDataAuthorizations(scopes);
            const accessAuth = await this.createAccessAuthorization(needGroup);
            await this.authorizationRegistry.addAccessAuthorization(accessAuth);
            result.push(new AuthorizationResult(accessAuth, dataAuth));
        }
        return result;
    }

    async createDataAuthorizations(dataAccessScopes: DataAccessScope[]) {
        for (const dataAccessScope of dataAccessScopes) {
            const shapeTree = dataAccessScope.accessNeed.RegisteredShapeTree;
            const dataRegs: DataRegistration[] = await this.authorizationAgent.AllDataRegistrations;
            const exists = dataRegs.some((dataReg) => dataReg.RegisteredShapeTree === shapeTree);

            if (!exists) {
                const fetch = this.authorizationAgent.session.fetch;
                const dataReg = DataRegistration.new(
                    this.authorizationAgent.generateId(this.dataRegistry.uri) + "/",
                    fetch,
                    this.authorizationAgent.socialAgent,
                    this.authorizationAgent.authorizationAgent,
                    new Date(),
                    new Date(),
                    shapeTree,
                );

                await this.dataRegistry.addHasDataRegistration(await dataReg);
            }

            const dataAuthorization = await dataAccessScope.toDataAuthorization(this);
            this.dataAuthorizations.set(dataAccessScope.accessNeed.uri, dataAuthorization);
        }
        return this.getCreatedDataAuthorizations();
    }

    private getCreatedDataAuthorizations(): DataAuthorization[] {
        return Array.from(this.dataAuthorizations.values());
    }

    createAccessAuthorization(accessNeedGroup: AccessNeedGroup): Promise<AccessAuthorization> {
        return AccessAuthorization.new(
            // TODO: Reduce input parameters, e.g. this.generateId() is trivial and can be done in the fucntion.
            this.generateId(),
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.socialAgent,
            this.authorizationAgent.authorizationAgent,
            this.grantee,
            accessNeedGroup,
            this.getCreatedDataAuthorizations(),
        );
    }
}
