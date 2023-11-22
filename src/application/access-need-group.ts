import {
  AccessAuthorization,
  Agent,
  DataAuthorization,
  Fetch,
} from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeed } from "./access-need";
import { AuthorizationAgent } from "../authorization-agent";
import { parseTurtle } from "../utils/turtle-parser";
import { DatasetCore } from "@rdfjs/types";
import { DataFactory, Prefixes } from "n3";

export class AccessNeedGroup extends RdfDocument {
  constructor(
    uri: string,
    dataset?: DatasetCore,
    prefixes?: Prefixes,
  ) {
    super(uri, dataset, prefixes)
  }

  static async getRdfDocument(
    uri: string,
    fetch: Fetch,
  ): Promise<AccessNeedGroup> {
    return fetch(uri)
    .then((res) => res.text())
    .then((res) => {console.log(res); return parseTurtle(res, uri)})
    .then(result => new AccessNeedGroup(uri, result.dataset.match(DataFactory.namedNode(uri)), result.prefixes));
  }

  gethasAccessDescriptionSet(): string[] | undefined {
    return this.getObjectValuesFromPredicate(
      INTEROP + "hasAccessDescriptionSet",
    );
  }

  getAccessNecessity() {
    return this.getObjectValueFromPredicate(INTEROP + "accessNecessity")!;
  }

  getAccessScenario(): string[] {
    return this.getObjectValuesFromPredicate(INTEROP + "accessScenario")!;
  }

  getAuthenticatesAs() {
    return this.getObjectValueFromPredicate(INTEROP + "authenticatesAs")!;
  }

  async getHasAccessNeed(fetch: Fetch) {
    let needs: AccessNeed[] = [];
    for (const uri of this.getObjectValuesFromPredicate(
      INTEROP + "hasAccessNeed",
    )!) {
      needs.push(await AccessNeed.getRdfDocument(uri, fetch));
    }
    return needs;
  }

  getReplaces(): string | undefined {
    return this.getObjectValueFromPredicate(INTEROP + "replaces");
  }

  toAccessAuthorization(
    id: string,
    authorization_agent: AuthorizationAgent,
    grantee: Agent,
    data_authorizations: DataAuthorization[],
  ): AccessAuthorization {
    return new AccessAuthorization(
      id,
      authorization_agent.social_agent,
      authorization_agent.authorization_agent,
      new Date(),
      grantee,
      this.uri,
      data_authorizations,
    );
  }
}
