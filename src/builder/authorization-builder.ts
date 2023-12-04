import {
    AccessAuthorization,
    AccessNeedGroup,
    Agent,
    DataAuthorization,
    DataRegistration,
    DataRegistryResource,
    getResource,
} from "solid-interoperability";
import { AuthorizationAgent } from "../authorization-agent";
import { DataAccessScope } from "../application/data-access-scope";
import {
    updateContainerResource,
} from "../utils/modify-pod";
import N3 from "n3";

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
        const shapeTree = dataAccessScope.accessNeed.RegisteredShapeTree;
        if (!shapeTree)
            throw new Error(
                `The access need ${dataAccessScope.accessNeed.uri} has no registrated RegisteredShapeTree.`,
            );

        const dataRegs: DataRegistration[] = await this.authorizationAgent.AllDataRegistrations;
        const exists = dataRegs.some((dataReg) => dataReg.RegisteredShapeTree === shapeTree);

        if (!exists) {
            const fetch = this.authorizationAgent.session.fetch;
            const dataReg = DataRegistration.new(
                this.authorizationAgent.generateId(this.authorizationAgent.dataRegistryContainer) +
                    "/",
                fetch,
                this.authorizationAgent.socialAgent,
                this.authorizationAgent.authorizationAgent,
                new Date(),
                new Date(),
                shapeTree,
            )

            const dataRegistry = await getResource(
                DataRegistryResource,
                this.authorizationAgent.session.fetch,
                this.authorizationAgent.dataRegistryContainer,
            );
            await dataRegistry.addHasDataRegistration(dataReg);
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

    async updateParentContainerMetaData() {
        const accessAuthoriza = this.getCreatedAccessAuthorization();

        const authorizationRegistryStore = new Store();
        authorizationRegistryStore.addQuad(
            namedNode(this.authorizationAgent.authorizationRegistryContainer),
            namedNode("interop:hasAccessAuthorization"),
            namedNode(accessAuthoriza.uri),
        );
        await updateContainerResource(
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.authorizationRegistryContainer,
            authorizationRegistryStore,
        );
    }

    async createAccessAuthorization(accessNeedGroup: AccessNeedGroup) {
        this.accessAuthorizations = await accessNeedGroup.toAccessAuthorization( // TODO: Reduce input parameters, e.g. this.generateId() is trivial and can be done in the fucntion.
            this.generateId(),
            this.authorizationAgent.session.fetch,
            this.authorizationAgent.socialAgent,
            this.authorizationAgent.authorizationAgent,
            this.grantee,
            this.getCreatedDataAuthorizations(),
        );
    }
}
