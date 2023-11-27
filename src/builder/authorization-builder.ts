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
import {
    insertTurtleResource,
    createContainer,
    updateContainerResource,
} from "../utils/modify-pod";
import N3 from "n3";
const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;
import { parseTurtle } from "../utils/turtle-parser";
import { DataRegistryResource } from "../data-registry-container";
import { getResource } from "../rdf-document";

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
        const shapeTree = dataAccessScope.accessNeed.getRegisteredShapeTree();
        if (!shapeTree)
            throw new Error(
                `The access need ${dataAccessScope.accessNeed.uri} has no registrated RegisteredShapeTree.`,
            );

        const dataRegs: DataRegistration[] =
            await this.authorizationAgent.AllDataRegistrations;
        const exists = dataRegs.some((dataReg) => dataReg.registeredShapeTree === shapeTree);

        if (!exists) {
            const dataReg = new DataRegistration(
                this.authorizationAgent.generateId(this.authorizationAgent.DataRegistry_container) +
                    "/",
                this.authorizationAgent.social_agent,
                this.authorizationAgent.authorization_agent,
                new Date(),
                new Date(),
                shapeTree,
            );

            const fetch = this.authorizationAgent.session.fetch;
            await createContainer(fetch, dataReg.id);
            const container_iri = dataReg.id;

            const dataset: string = (await new RdfFactory().create(dataReg)) as string;

            const serializedDataset = (await parseTurtle(dataset, dataReg.id)).dataset;

            await updateContainerResource(
                this.authorizationAgent.session.fetch,
                container_iri,
                serializedDataset,
            );

            const dataRegistry = await getResource(
                DataRegistryResource,
                this.authorizationAgent.session.fetch,
                this.authorizationAgent.DataRegistry_container,
            );
            await dataRegistry.addHasDataRegistration(
                this.authorizationAgent.session.fetch,
                dataReg,
            );
        }

        const data_authorization = await dataAccessScope.toDataAuthorization(this);
        this.data_authorizations.set(dataAccessScope.accessNeed.uri, data_authorization);
    }

    getCreatedDataAuthorizations(): DataAuthorization[] {
        return Array.from(this.data_authorizations.values());
    }

    getCreatedAccessAuthorization(): AccessAuthorization {
        if (!this.access_authorizations)
            throw new Error("The access authorization has not been generated.");
        return this.access_authorizations;
    }

    async storeToPod() {
        this.getCreatedDataAuthorizations().forEach(async (data_authoriza) => {
            const turtle = await new RdfFactory().create(data_authoriza); // Error handling
            insertTurtleResource(this.authorizationAgent.session.fetch, data_authoriza.id, turtle);
        });

        const access_authoriza = this.getCreatedAccessAuthorization();
        const turtle = await new RdfFactory().create(access_authoriza); // Error handling
        insertTurtleResource(this.authorizationAgent.session.fetch, access_authoriza.id, turtle);

        const AuthorizationRegistry_store = new Store();
        AuthorizationRegistry_store.addQuad(
            namedNode(this.authorizationAgent.AuthorizationRegistry_container),
            namedNode("interop:hasAccessAuthorization"),
            namedNode(access_authoriza.id),
        );
        await updateContainerResource(
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.AuthorizationRegistry_container,
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
