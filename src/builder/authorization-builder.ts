import {
    AccessAuthorization,
    Agent,
    DataAuthorization,
    DataRegistration,
    RdfFactory,
    parseTurtle,
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
import { DataRegistryResource } from "../data-registry-container";
import { getResource } from "../rdf-document";

const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;

export class AuthorizationBuilder {
    private dataAuthorizations: Map<string, DataAuthorization> = new Map<
        string,
        DataAuthorization
    >();
    private accessAuthorizations!: AccessAuthorization;

    constructor(
        public authorizationAgent: AuthorizationAgent,
        public grantee: Agent,
    ) {}

    generateId(): string {
        return this.authorizationAgent.generateId(
            this.authorizationAgent.authorizationRegistryContainer,
        );
    }

    async createDataAuthorization(dataAccessScope: DataAccessScope) {
        const shapeTree = dataAccessScope.accessNeed.getRegisteredShapeTree();
        if (!shapeTree)
            throw new Error(
                `The access need ${dataAccessScope.accessNeed.uri} has no registrated RegisteredShapeTree.`,
            );

        const dataRegs: DataRegistration[] = await this.authorizationAgent.AllDataRegistrations;
        const exists = dataRegs.some((dataReg) => dataReg.registeredShapeTree === shapeTree);

        if (!exists) {
            const dataReg = new DataRegistration(
                this.authorizationAgent.generateId(this.authorizationAgent.dataRegistryContainer) +
                    "/",
                this.authorizationAgent.socialAgent,
                this.authorizationAgent.authorizationAgent,
                new Date(),
                new Date(),
                shapeTree,
            );

            const fetch = this.authorizationAgent.session.fetch;
            await createContainer(fetch, dataReg.id);
            const containerIri = dataReg.id;

            const dataset: string = (await new RdfFactory().create(dataReg)) as string;

            const serializedDataset = (await parseTurtle(dataset, dataReg.id)).dataset;

            await updateContainerResource(
                this.authorizationAgent.session.fetch,
                containerIri,
                serializedDataset,
            );

            const dataRegistry = await getResource(
                DataRegistryResource,
                this.authorizationAgent.session.fetch,
                this.authorizationAgent.dataRegistryContainer,
            );
            await dataRegistry.addHasDataRegistration(
                this.authorizationAgent.session.fetch,
                dataReg,
            );
        }

        const dataAuthorization = await dataAccessScope.toDataAuthorization(this);
        this.dataAuthorizations.set(dataAccessScope.accessNeed.uri, dataAuthorization);
    }

    getCreatedDataAuthorizations(): DataAuthorization[] {
        return Array.from(this.dataAuthorizations.values());
    }

    getCreatedAccessAuthorization(): AccessAuthorization {
        if (!this.accessAuthorizations)
            throw new Error("The access authorization has not been generated.");
        return this.accessAuthorizations;
    }

    async storeToPod() {
        this.getCreatedDataAuthorizations().forEach(async (dataAuthoriza) => {
            const turtle = await new RdfFactory().create(dataAuthoriza); // Error handling
            insertTurtleResource(this.authorizationAgent.session.fetch, dataAuthoriza.id, turtle);
        });

        const accessAuthoriza = this.getCreatedAccessAuthorization();
        const turtle = await new RdfFactory().create(accessAuthoriza); // Error handling
        insertTurtleResource(this.authorizationAgent.session.fetch, accessAuthoriza.id, turtle);

        const authorizationRegistryStore = new Store();
        authorizationRegistryStore.addQuad(
            namedNode(this.authorizationAgent.authorizationRegistryContainer),
            namedNode("interop:hasAccessAuthorization"),
            namedNode(accessAuthoriza.id),
        );
        await updateContainerResource(
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.authorizationRegistryContainer,
            authorizationRegistryStore,
        );
    }

    async createAccessAuthorization(accessNeedGroup: AccessNeedGroup) {
        this.accessAuthorizations = await accessNeedGroup.toAccessAuthorization(
            this.generateId(),
            this.authorizationAgent,
            this.grantee,
            this.getCreatedDataAuthorizations(),
        );
    }
}
