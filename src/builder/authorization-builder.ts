import {
  AccessAuthorization,
  Agent,
  DataAuthorization,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import { AccessNeedGroup } from "../application/access-need-group";

export class AuthorizationBuilder {
  private data_authorizations: Map<string, DataAuthorization> = new Map<
    string,
    DataAuthorization
  >();
  private access_authorizations!: AccessAuthorization;

  constructor(
    public authorizationAgent: AuthorizationAgent,
    public grantee: Agent,
  ) {}

  generateId(): string {
    return this.authorizationAgent.generateId(
      this.authorizationAgent.AuthorizationRegistry_container,
    );
  }

  async createDataAuthorization(dataAccessScope: DataAccessScope) {
    const data_authorizations = await dataAccessScope.toDataAuthoization(this);
    this.data_authorizations.set(
      dataAccessScope.accessNeed.uri,
      data_authorizations,
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
