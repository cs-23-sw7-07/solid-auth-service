import N3, { DataFactory, Prefixes, Store } from "n3";
import { DatasetCore } from "@rdfjs/types";
import { Fetch } from "solid-interoperability";
import { ParserResult, parseTurtle } from "../utils/turtle-parser";
const { namedNode } = DataFactory;

export class RdfDocument {
  dataset: DatasetCore = new Store();
  prefixes: Prefixes = {};

  constructor(
    public uri: string,
    dataset?: DatasetCore,
    prefixes?: Prefixes,
  ) {}

  static async getRdfDocument(uri: string, fetch: Fetch): Promise<RdfDocument> {
    const result: ParserResult = await fetch(uri)
      .then((res) => res.text())
      .then((res) => parseTurtle(res, uri));
    return new RdfDocument(uri, result.dataset, result.prefixes);
  }

  getObjectValueFromPredicate(predicate: string): string | undefined {
    const values = this.getObjectValuesFromPredicate(predicate);
    if (values && values.length == 1) {
      return values[0];
    }
    return undefined;
  }

  getObjectValuesFromPredicate(predicate: string): string[] | undefined {
    const quads = this.dataset.match(namedNode(this.uri), namedNode(predicate));

    let values: string[] = [];
    for (const quad of quads) {
      values.push(quad.object.value);
    }

    return values.length != 0 ? values : undefined;
  }
}
