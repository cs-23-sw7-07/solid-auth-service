import { AccessAuthorization, Agent, DataAuthorization } from "solid-interoperability";
import { AuthorizationAgent } from "../../authorization-agent";
import { AccessNeedGroup } from "../application/access-need-group";
import { DataAuthorizationBuilder } from "./data-authorizations-builder";

export class AccessAuthorizationBuilder {
    access_authorizations: AccessAuthorization[] = []

    constructor(public authorizationAgent : AuthorizationAgent, public grantee: Agent, public data_authorization_builder: DataAuthorizationBuilder) {
    }

    newId(): string {
        return this.authorizationAgent.newId(this.authorizationAgent.AuthorizationRegistry_container)
    }

    async createAccessAuthorization(access_need_group: AccessNeedGroup) {
        const access_authorization = await access_need_group.toAccessAuthorization(this.newId(), this.authorizationAgent, this.grantee, this.data_authorization_builder.getCreatedDataAuthorization());
        this.access_authorizations.push(access_authorization)
    }

    getCreatedAccessAuthorization(): AccessAuthorization[] {
        return Array.from(this.access_authorizations.values())
    }
}