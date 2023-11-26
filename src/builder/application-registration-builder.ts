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
    private data_grants: DataGrant[] = [];
    private access_grants: AccessGrant[] = [];
    private registration: AgentRegistration | undefined = undefined;

    constructor(private authorization_agent: AuthorizationAgent) {}

    async build(registeredAgent: Agent, authorization_builder: AuthorizationBuilder[]) {
        const id = this.authorization_agent.AgentRegistry_container + randomUUID() + "/";

        let builders: GrantNeedGroupBuilder[] = [];
        for (const builder of authorization_builder) {
            const grant_builder = new GrantNeedGroupBuilder(this.authorization_agent, id);
            await grant_builder.createDataGrants(builder.getCreatedDataAuthorizations());
            await grant_builder.createAccessGrant(builder.getCreatedAccessAuthorization());

            for (const grant of grant_builder.getDataGrants()) {
                this.data_grants.push(grant);
            }
            this.access_grants.push(grant_builder.getAccessGrant());
            builders.push(grant_builder);
        }

        this.registration = new ApplicationRegistration(
            id,
            this.authorization_agent.social_agent,
            this.authorization_agent.authorization_agent,
            new Date(),
            new Date(),
            registeredAgent,
            builders.map((builder) => builder.getAccessGrant()),
        );
    }

    async storeToPod() {
        if (!this.registration)
            throw new Error("Not able to store in pod, because AgentRegistration is not created");

        const session: Session = this.authorization_agent.session;
        const factory: RdfFactory = new RdfFactory();
        for (const grant of this.data_grants) {
            await insertTurtleResource(session, grant.id, await factory.create(grant));
        }

        for (const grant of this.access_grants) {
            await insertTurtleResource(session, grant.id, await factory.create(grant));
        }

        const registration_turtle = await factory.create(this.registration);

        await updateContainerResource(
            session.fetch,
            this.registration.id + ".meta",
            (await parseTurtle(registration_turtle, this.registration.id)).dataset,
        );
    }

    getAgentRegistration(): AgentRegistration {
        if (!this.registration)
            throw new Error("Not able to store in pod, because AgentRegistration is not created");

        return this.registration;
    }
}

export class GrantNeedGroupBuilder implements IDataGrantBuilder {
    private data_grants: Map<DataAuthorization, DataGrant[]> = new Map<
        DataAuthorization,
        DataGrant[]
    >();
    private access_grant: AccessGrant | undefined = undefined;

    constructor(
        private authorization_agent: AuthorizationAgent,
        private container: string,
    ) {}

    getAllDataRegistrations(
        registeredShapeTree: string,
        dataOwner?: SocialAgent | undefined,
    ): Promise<DataRegistration[]> {
        return this.authorization_agent.getDataRegistrations(registeredShapeTree, dataOwner);
    }
    getInheritedDataGrants(auth: DataAuthorization): Promise<DataGrant[]> {
        if (!this.data_grants.get(auth))
            throw new Error(
                "The corresponding data grants of the inherited data authorization have not been build.",
            );
        return Promise.resolve(this.data_grants.get(auth)!);
    }

    generateId(): string {
        return this.authorization_agent.generateId(this.container);
    }

    async createDataGrants(data_authorizations: DataAuthorization[]) {
        for (const auth of data_authorizations) {
            this.data_grants.set(auth, await auth.toDataGrant(this));
        }
    }

    getDataGrants(): DataGrant[] {
        return Array.from(this.data_grants.values()).flat();
    }

    createAccessGrant(access_authorization: AccessAuthorization) {
        this.access_grant = access_authorization.toAccessGrant(
            this.generateId(),
            this.getDataGrants(),
        );
    }

    getAccessGrant(): AccessGrant {
        if (!this.access_grant) throw new Error("The access grant has not been generated.");
        return this.access_grant;
    }
}
