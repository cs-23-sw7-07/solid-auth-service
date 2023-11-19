import { DataAuthorization } from "solid-interoperability";
import { AuthorizationAgent } from "../../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";

export class DataAuthorizationBuilder {
    data_authorizations: Map<string, DataAuthorization[]> = new Map<string, DataAuthorization[]>

    constructor(public authorizationAgent : AuthorizationAgent) {
        
    }

    newId(): string {
        return this.authorizationAgent.newId(this.authorizationAgent.AuthorizationRegistry_container)
    }

    async createDataAuthorization(dataAccessScope: DataAccessScope) {
        const data_authorizations = await dataAccessScope.toDataAuthoization(this);
        this.data_authorizations.set(dataAccessScope.accessNeed.uri, data_authorizations)
    }

    getCreatedDataAuthorization(): DataAuthorization[] {
        return Array.from(this.data_authorizations.values()).flat()
    }

}