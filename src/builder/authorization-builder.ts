import {
  AccessAuthorization,
  Agent,
  DataAuthorization,
  RdfFactory,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import { AccessNeedGroup } from "../application/access-need-group";
import { insertTurtleResource, updateContainerResource } from "../utils/modify-pod";
import N3 from "n3";
const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;

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

  async createDataAuthorizations(dataAccessScopes: DataAccessScope[]) {
    for (const scope of dataAccessScopes) {
      const data_authorizations = await scope.toDataAuthoization(this);
      this.data_authorizations.set(
        scope.accessNeed.uri,
        data_authorizations,
      );
    }

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

  async storeToPod() {
    this
      .getCreatedDataAuthorizations()
      .forEach(async (data_authoriza) => {
        const turtle = (await new RdfFactory().create(
          data_authoriza,
        )); // Error handling
        insertTurtleResource(this.authorizationAgent.session, data_authoriza.id, turtle);
      });

    const access_authoriza =
      this.getCreatedAccessAuthorization();
    const turtle = (await new RdfFactory().create(
      access_authoriza,
    )); // Error handling
    insertTurtleResource(this.authorizationAgent.session, access_authoriza.id, turtle);

    const AuthorizationRegistry_store = new Store();
    AuthorizationRegistry_store.addQuad(
      namedNode(this.authorizationAgent.AuthorizationRegistry_container),
      namedNode("interop:hasAccessAuthorization"),
      namedNode(access_authoriza.id),
    );
    await updateContainerResource(
      this.authorizationAgent.session,
      this.authorizationAgent.AuthorizationRegistry_container + ".meta",
      AuthorizationRegistry_store,
    );
  }

}
