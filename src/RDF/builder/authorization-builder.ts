// import { AccessAuthorization, Agent, DataAuthorization } from "solid-interoperability";
// import { AuthorizationAgent } from "../../authorization-agent";
// import { DataAccessScope } from "../application/data-access-scope";
// import { AccessNeedGroup } from "../application/access-need-group";

// export class AuthorizationBuilder {
//     data_authorizations: Map<string, DataAuthorization[]> = new Map<string, DataAuthorization[]>
//     access_authorizations: AccessAuthorization[] = []

//     constructor(public authorizationAgent : AuthorizationAgent, public grantee: Agent){}

//     newId(): string {
//         return this.authorizationAgent.newId(this.authorizationAgent.AuthorizationRegistry_container)
//     }

//     async createDataAuthorization(dataAccessScope: DataAccessScope) {
//         const data_authorizations = await dataAccessScope.toDataAuthoization(this);
//         this.data_authorizations.set(dataAccessScope.accessNeed.uri, data_authorizations)
//     }

//     async createAccess(need_group: AccessNeedGroup, access_scope: DataAccessScope[]) {
//         let
//     }

//     async createAccessAuthorization(access_need_group: AccessNeedGroup, data_authorization: DataAuthorization[]) {
//         const access_authorization = await access_need_group.toAccessAuthorization(this.newId(), this.authorizationAgent, this.grantee, data_authorization);
//         this.access_authorizations.push(access_authorization)
//     }
// }