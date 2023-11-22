import { DatasetCore } from "@rdfjs/types";
import { RdfDocument } from "./rdf-document";
import { Prefixes } from "n3";
import { INTEROP } from "./namespace";

export class RegistrySetResource extends RdfDocument {
    constructor(
        webId: string,
        dataset?: DatasetCore,
        prefixes?: Prefixes,
      ) {
        super(webId, dataset, prefixes)
      }

      gethasAgentRegistry(): string {
        return this.getObjectValueFromPredicate(INTEROP + "hasAgentRegistry")!;
      }

      gethasAuthorizationRegistry(): string {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationRegistry")!;
      }

      gethasDataRegistry(): string {
        return this.getObjectValueFromPredicate(INTEROP + "hasDataRegistry")!;
      }
}