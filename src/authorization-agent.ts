import N3 from "n3";
import { Session } from "@inrupt/solid-client-authn-node";
import { randomUUID } from "crypto";
import {
  createContainer,
  insertTurtleResource,
  readResource,
  updateContainerResource,
} from "./utils/modify-pod";
import { type_a, INTEROP} from "./namespace";
import { SocialAgentProfileDocument } from "./profile-documents/social-agent-profile-document";
import {
  AccessAuthorization,
  AgentRegistration,
  ApplicationAgent,
  ApplicationRegistration,
  DataAuthorization,
  DataRegistration,
  NotImplementedYet,
  RdfFactory,
  SocialAgent,
} from "solid-interoperability";
import { parseTurtle } from "./utils/turtle-parser";
import { Approval } from "./application/approval";
import { AuthorizationBuilder } from "./builder/authorization-builder";
import { AgentRegistrationBuilder } from "./builder/application-registration-builder";
import { RdfDocument } from "./rdf-document";

const { Store, DataFactory } = N3;
const { namedNode } = DataFactory;

export class AuthorizationAgent {
  registries_container: string;
  AgentRegistry_container: string;
  AuthorizationRegistry_container: string;
  DataRegistry_container: string;

  constructor(
    public social_agent: SocialAgent,
    public authorization_agent: ApplicationAgent,
    public pod: string,
    public session: Session,
  ) {
    this.registries_container = this.pod + "Registries/";
    this.AgentRegistry_container = this.pod + "Registries/agentregisties/";
    this.AuthorizationRegistry_container =
      this.pod + "Registries/accessregisties/";
    this.DataRegistry_container = this.pod + "data/";
  }

  async createRegistriesSet() {
    createContainer(this.session, this.registries_container);
    createContainer(this.session, this.AgentRegistry_container);
    createContainer(this.session, this.AuthorizationRegistry_container);
    createContainer(this.session, this.DataRegistry_container);

    const profile_document: SocialAgentProfileDocument =
      await SocialAgentProfileDocument.getProfileDocument(this.social_agent.webID);
    await profile_document.updateProfile(this.session);

    const registries_store = new Store();
    registries_store.addQuad(
      namedNode(this.registries_container),
      type_a,
      namedNode("interop:RegistrySet"),
    );
    registries_store.addQuad(
      namedNode(this.registries_container),
      namedNode("interop:hasAgentRegistry"),
      namedNode(this.AgentRegistry_container),
    );
    registries_store.addQuad(
      namedNode(this.registries_container),
      namedNode("interop:hasAuthorizationRegistry"),
      namedNode(this.AuthorizationRegistry_container),
    );
    registries_store.addQuad(
      namedNode(this.registries_container),
      namedNode("interop:hasDataRegistry"),
      namedNode(this.DataRegistry_container),
    );

    await updateContainerResource(
      this.session,
      this.registries_container + ".meta",
      registries_store,
    );
  }

  generateId(uri: string) {
    return uri + randomUUID();
  }

  async newAccessAuthorization(
    registeredAgent: ApplicationAgent,
    hasAccessNeedGroup: string,
    data_authorizations: DataAuthorization[],
  ) {
    return new AccessAuthorization(
      this.generateId(this.AuthorizationRegistry_container),
      this.social_agent,
      this.authorization_agent,
      new Date(),
      registeredAgent,
      hasAccessNeedGroup,
      data_authorizations,
    );
  }

  async newApplication(approval: Approval) {
    let authorizationBuilders: AuthorizationBuilder[] = [];
    approval.access.forEach((dataAccessScopes, needGroup) => {
      const authorizationBuilder = new AuthorizationBuilder(
        this,
        approval.agent,
      );
      dataAccessScopes.forEach((dataAccessScope) => {
        authorizationBuilder.createDataAuthorization(dataAccessScope);
      });
      authorizationBuilder.createAccessAuthorization(needGroup);
      authorizationBuilders.push(authorizationBuilder);
    });

    for (const authorizationBuilder of authorizationBuilders) {
      authorizationBuilder
        .getCreatedDataAuthorizations()
        .forEach(async (data_authoriza) => {
          const turtle = (await new RdfFactory().create(
            data_authoriza,
          )) as string; // Error handling
          insertTurtleResource(this.session, data_authoriza.id, turtle);
        });

      const access_authoriza =
        authorizationBuilder.getCreatedAccessAuthorization();
      const turtle = (await new RdfFactory().create(
        access_authoriza,
      )) as string; // Error handling
      insertTurtleResource(this.session, access_authoriza.id, turtle);

      const AuthorizationRegistry_store = new Store();
      AuthorizationRegistry_store.addQuad(
        namedNode(this.AuthorizationRegistry_container),
        namedNode("interop:hasAccessAuthorization"),
        namedNode(access_authoriza.id),
      );
      await updateContainerResource(
        this.session,
        this.AuthorizationRegistry_container + ".meta",
        AuthorizationRegistry_store,
      );
    }

    const builder = new AgentRegistrationBuilder(this);
    builder.build(approval.agent, authorizationBuilders);
    builder.storeToPod();

    const predicate =
      approval.agent instanceof ApplicationAgent
        ? "interop:hasApplicationRegistration"
        : "interop:hasSocialAgentRegistration";
    const AgentRegistry_store = new Store();
    AgentRegistry_store.addQuad(
      namedNode(this.AgentRegistry_container),
      namedNode(predicate),
      namedNode(builder.getAgentRegistration().id),
    );
    await updateContainerResource(
      this.session,
      this.AgentRegistry_container + ".meta",
      AgentRegistry_store,
    );
  }

  async findRegistration(client_id: string): Promise<AgentRegistration> {
    const parse_result = await parseTurtle(
      await readResource(this.session, this.AgentRegistry_container),
      this.AgentRegistry_container,
    );
    const agent_registry_set = new RdfDocument(
      this.AgentRegistry_container,
      parse_result.dataset,
      parse_result.prefixes,
    );
    const type = agent_registry_set.getObjectValueFromPredicate(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );

    const registration_type =
      type == INTEROP + "Application"
        ? "hasApplicationRegistration"
        : "hasSocialAgentRegistration";

    const registrations_iri = agent_registry_set.getObjectValuesFromPredicate(
      INTEROP + registration_type,
    );

    const factory = new RdfFactory();
    const rdfs = registrations_iri?.map(
      async (iri) =>
        await factory.parse(
          this.session.fetch,
          await readResource(this.session, iri),
        ),
    );

    let agent_registration = [];
    if (type == INTEROP + "Application") {
      agent_registration = rdfs!.map(async (rdf) =>
        ApplicationRegistration.makeApplicationRegistration(await rdf),
      );
    } else {
      throw new NotImplementedYet();
    }

    for (const reg of agent_registration) {
      if ((await reg).registeredAgent.webID == client_id) return reg;
    }

    throw new ApplicationRegistrationNotExist();
  }

  getAllRegistrations(): Promise<DataRegistration[]> {
    return readResource(this.session, this.DataRegistry_container)
      .then((turtle) => parseTurtle(turtle, this.DataRegistry_container))
      .then(async (parse_result) => {
        const dataset = parse_result.dataset;
        let registration: DataRegistration[] = [];
        const rdf_creater = new RdfFactory();
        const data_registration_predicate =
          "http://www.w3.org/ns/solid/interop#hasDataRegistration";
        for (const quad of dataset.match(
          null,
          namedNode(data_registration_predicate),
        )) {
          registration.push(
            await rdf_creater
              .parse(this.session.fetch, quad.object.value)
              .then(DataRegistration.makeDataRegistration)
              .catch((e) => {
                throw e;
              }),
          );
        }

        return registration;
      });
  }

  getDataRegistrations(
    shapeTree: string,
    dataOwner?: SocialAgent,
  ): Promise<DataRegistration[]> {
    const predicateShapeTree = (dataReg: DataRegistration) =>
      dataReg.registeredShapeTree == shapeTree;
    const predicateDataOwner = (dataReg: DataRegistration) => {
      if (dataOwner) {
        return dataReg.registeredBy == dataOwner;
      }
      return true;
    };
    return this.getAllRegistrations().then((regs) =>
      regs.filter((reg) => predicateShapeTree(reg) && predicateDataOwner(reg)),
    );
  }
}

export class ApplicationRegistrationNotExist extends Error {}
