import {
    AccessAuthorization,
    Agent,
    DataAuthorization,
    DataRegistration,
    RdfFactory,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import { AccessNeedGroup } from "../application/access-need-group";
import { insertTurtleResource, updateContainerResource } from "../utils/modify-pod";
import N3 from "n3";
const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;
import { createContainer, updateContainerResource } from "../utils/modify-pod";
import { parseTurtle } from "../utils/turtle-parser";

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
            const dataReg = new DataRegistration(
                this.authorizationAgent.generateId(this.authorizationAgent.DataRegistry_container),
                this.authorizationAgent.social_agent,
                this.authorizationAgent.authorization_agent,
                new Date(),
                new Date(),
                shapeTree
            );
            const fetch = this.authorizationAgent.session.fetch;
            createContainer(fetch, dataReg.id);
            const container_iri = dataReg.id + '.meta';
            const dataset: string = await new RdfFactory().create(dataReg) as string;
            const serializedDataset = (await parseTurtle(dataset, dataReg.id)).dataset;
            updateContainerResource(this.authorizationAgent.session, container_iri, serializedDataset);
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

    async createAccessAuthorization(access_need_group: AccessNeedGroup) {
        this.access_authorizations = await access_need_group.toAccessAuthorization(
            this.generateId(),
            this.authorizationAgent,
            this.grantee,
            this.getCreatedDataAuthorizations(),
        );
    }
}
