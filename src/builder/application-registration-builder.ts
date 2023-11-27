import { randomUUID } from "crypto";
import { AuthorizationAgent } from "../authorization-agent";
import {
    AccessAuthorization,
    AccessGrant,
    Agent,
    AgentRegistration,
    ApplicationRegistration,
    DataAuthorization,
    DataGrant,
    DataRegistration,
    IDataGrantBuilder,
    RdfFactory,
    SocialAgent,
} from "solid-interoperability";
import { AuthorizationBuilder } from "./authorization-builder";
import { insertTurtleResource, updateContainerResource } from "../utils/modify-pod";
import { Session } from "@inrupt/solid-client-authn-node";
import { parseTurtle } from "../utils/turtle-parser";

export class AgentRegistrationBuilder {
    private dataGrants: DataGrant[] = [];
    private accessGrants: AccessGrant[] = [];
    private registration: AgentRegistration | undefined = undefined;

    constructor(private authorizationAgent: AuthorizationAgent) {}

    async build(registeredAgent: Agent, authorizationBuilder: AuthorizationBuilder[]) {
        const id = this.authorizationAgent.agentRegistryContainer + randomUUID() + "/";

        let builders: GrantNeedGroupBuilder[] = [];
        for (const builder of authorizationBuilder) {
            const grantBuilder = new GrantNeedGroupBuilder(this.authorizationAgent, id);
            await grantBuilder.createDataGrants(builder.getCreatedDataAuthorizations());
            await grantBuilder.createAccessGrant(builder.getCreatedAccessAuthorization());

            for (const grant of grantBuilder.getDataGrants()) {
                this.dataGrants.push(grant);
            }
            this.accessGrants.push(grantBuilder.getAccessGrant());
            builders.push(grantBuilder);
        }

        this.registration = new ApplicationRegistration(
            id,
            this.authorizationAgent.socialAgent,
            this.authorizationAgent.authorizationAgent,
            new Date(),
            new Date(),
            registeredAgent,
            builders.map((builder) => builder.getAccessGrant()),
        );
    }

    async storeToPod() {
        if (!this.registration)
            throw new Error("Not able to store in pod, because AgentRegistration is not created");

        const session: Session = this.authorizationAgent.session;
        const factory: RdfFactory = new RdfFactory();
        for (const grant of this.dataGrants) {
            await insertTurtleResource(session.fetch, grant.id, await factory.create(grant));
        }

        for (const grant of this.accessGrants) {
            await insertTurtleResource(session.fetch, grant.id, await factory.create(grant));
        }

        const registrationTurtle = await factory.create(this.registration);

        await updateContainerResource(
            session.fetch,
            this.registration.id,
            (await parseTurtle(registrationTurtle, this.registration.id)).dataset,
        );
    }

    getAgentRegistration(): AgentRegistration {
        if (!this.registration)
            throw new Error("Not able to store in pod, because AgentRegistration is not created");

        return this.registration;
    }
}

export class GrantNeedGroupBuilder implements IDataGrantBuilder {
    private dataGrants: Map<DataAuthorization, DataGrant[]> = new Map<
        DataAuthorization,
        DataGrant[]
    >();
    private accessGrant: AccessGrant | undefined = undefined;

    constructor(
        private authorizationAgent: AuthorizationAgent,
        private container: string,
    ) {}

    getAllDataRegistrations(
        registeredShapeTree: string,
        dataOwner?: SocialAgent | undefined,
    ): Promise<DataRegistration[]> {
        return this.authorizationAgent.getDataRegistrations(registeredShapeTree, dataOwner);
    }
    getInheritedDataGrants(auth: DataAuthorization): Promise<DataGrant[]> {
        if (!this.dataGrants.get(auth))
            throw new Error(
                "The corresponding data grants of the inherited data authorization have not been build.",
            );
        return Promise.resolve(this.dataGrants.get(auth)!);
    }

    generateId(): string {
        return this.authorizationAgent.generateId(this.container);
    }

    async createDataGrants(dataAuthorizations: DataAuthorization[]) {
        for (const auth of dataAuthorizations) {
            this.dataGrants.set(auth, await auth.toDataGrant(this));
        }
    }

    getDataGrants(): DataGrant[] {
        return Array.from(this.dataGrants.values()).flat();
    }

    createAccessGrant(accessAuthorization: AccessAuthorization) {
        this.accessGrant = accessAuthorization.toAccessGrant(
            this.generateId(),
            this.getDataGrants(),
        );
    }

    getAccessGrant(): AccessGrant {
        if (!this.accessGrant) throw new Error("The access grant has not been generated.");
        return this.accessGrant;
    }
}
