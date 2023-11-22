import { Fetch, SocialAgent } from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../namespace";
import { AccessNeedGroup } from "../application/access-need-group";
import { DatasetCore } from "@rdfjs/types";
import { DataFactory, Prefixes } from "n3";
import { parseTurtle } from "../utils/turtle-parser";

export class ApplicationProfileDocument extends RdfDocument {
  constructor(
    webId: string,
    dataset?: DatasetCore,
    prefixes?: Prefixes,
  ) {
    super(webId, dataset, prefixes)
  }

  static async getRdfDocument(
    uri: string,
    fetch: Fetch,
  ): Promise<ApplicationProfileDocument> {
    return fetch(uri)
    .then((res) => res.text())
    .then((res) => parseTurtle(res, uri))
    .then(result => new ApplicationProfileDocument(uri, result.dataset.match(DataFactory.namedNode(uri)), result.prefixes));
  }

  getApplicationName(): string {
    return this.getObjectValueFromPredicate(INTEROP + "applicationName")!;
  }

  getApplicationDescription(): string {
    return this.getObjectValueFromPredicate(
      INTEROP + "applicationDescription",
    )!;
  }

  getApplicationAuthor(): string {
    return this.getObjectValueFromPredicate(INTEROP + "applicationAuthor")!;
  }

  getApplicationThumbnail(): SocialAgent {
    const webId = this.getObjectValueFromPredicate(
      INTEROP + "applicationThumbnail",
    )!;
    return new SocialAgent(webId);
  }

  gethasAccessNeedGroup(fetch: Fetch): Promise<AccessNeedGroup>[] {
    const values = this.getObjectValuesFromPredicate(
      INTEROP + "hasAccessNeedGroup",
    )!;

    // console.log(this.dataset)
    return values.map(uri => AccessNeedGroup.getRdfDocument(uri, fetch));
  }

  getHasAuthorizationCallbackEndpoint(): string {
    return this.getObjectValueFromPredicate(
      INTEROP + "hasAuthorizationCallbackEndpoint",
    )!;
  }
}
