import {
    AccessAuthorization,
    Agent,
    DataAuthorization,
    DataRegistration,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import { AccessNeedGroup } from "../application/access-need-group";
import { forEachChild } from "typescript";

export class AuthorizationBuilder {
    private data_authorizations: Map<string, DataAuthorization> = new Map<
        string,
        DataAuthorization
    >();
    private access_authorizations!: AccessAuthorization;

    constructor(
        public authorizationAgent: AuthorizationAgent,
        public grantee: Agent,
    ) { }

    generateId(): string {
        return this.authorizationAgent.generateId(
            this.authorizationAgent.AuthorizationRegistry_container,
        );
    }

    async createDataAuthorization(dataAccessScope: DataAccessScope) {
        const shapeTree = dataAccessScope.accessNeed.getRegisteredShapeTree();

        const dataRegs: DataRegistration[] = await this.authorizationAgent.getAllRegistrations();

        const exists = dataRegs.some(dataReg => dataReg.registeredShapeTree === shapeTree);
        if (!exists) {
            new DataRegistration(
                this.authorizationAgent.generateId(this.authorizationAgent.DataRegistry_container),
                this.authorizationAgent.social_agent,
                this.authorizationAgent.authorization_agent,
                new Date(),
                new Date(),
                shapeTree
            );
        }
        const data_authorization = await dataAccessScope.toDataAuthoization(this);
            this.data_authorizations.set(
                dataAccessScope.accessNeed.uri,
                data_authorization,
            );
    }

    getCreatedDataAuthorizations(): DataAuthorization[] {
        return Array.from(this.data_authorizations.values());
    }

    async createAccessAuthorization(access_need_group: AccessNeedGroup) {
        this.access_authorizations = await access_need_group.toAccessAuthorization(
            this.generateId(),
            this.authorizationAgent,
            this.grantee,
            this.getCreatedDataAuthorizations(),
        );
    }

    getCreatedAccessAuthorization(): AccessAuthorization {
        return this.access_authorizations!;
    }
}
