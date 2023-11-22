import { AccessMode, Fetch, getAccessmode } from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../namespace";
import { DatasetCore } from "@rdfjs/types";
import { DataFactory, Prefixes } from "n3";
import { parseTurtle } from "../utils/turtle-parser";

export class AccessNeed extends RdfDocument {
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
  ): Promise<AccessNeed> {
    return fetch(uri)
    .then((res) => res.text())
    .then((res) => parseTurtle(res, uri))
    .then(result => new AccessNeed(uri, result.dataset.match(DataFactory.namedNode(uri)), result.prefixes));
  }

  getRegisteredShapeTree(): string {
    return this.getObjectValueFromPredicate(INTEROP + "registeredShapeTree")!;
  }

  getAccessModes(): AccessMode[] {
    const values: string[] = this.getObjectValuesFromPredicate(
      INTEROP + "accessMode",
    )!;
    return values.map((mode) => getAccessmode(mode));
  }

  getCreatorAccessModes() {
    const values: string[] = this.getObjectValuesFromPredicate(
      INTEROP + "creatorAccessMode",
    )!;
    return values.map((mode) => getAccessmode(mode));
  }

  getAccessNecessity() {
    return this.getObjectValueFromPredicate(INTEROP + "accessNecessity")!;
  }

  getHasDataInstance() {
    return this.getObjectValuesFromPredicate(INTEROP + "hasDataInstance")!;
  }

  async getInheritsFromNeed(fetch: Fetch) {
    const inherit_uri = this.getObjectValueFromPredicate(
      INTEROP + "inheritsFromNeed",
    )!;
    return await AccessNeed.getRdfDocument(inherit_uri, fetch);
  }
}
