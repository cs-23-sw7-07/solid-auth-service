import { AccessMode, Fetch, getAccessmode } from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../../namespace";

export class AccessNeed extends RdfDocument {
    constructor(uri: string) {
        super(uri);
    }

    static async getRdfDocument(uri: string, fetch: Fetch): Promise<AccessNeed> {
        return await RdfDocument.getRdfDocument(uri, fetch) as AccessNeed;
    }

    getRegisteredShapeTree(): string {
        return this.getObjectValueFromPredicate(INTEROP + "registeredShapeTree")!;
    }

    getAccessModes(): AccessMode[] {
        const values: string[] = this.getObjectValuesFromPredicate(INTEROP + "accessMode")!;
        return values.map(mode => getAccessmode(mode));
    }

    getCreatorAccessModes() {
        const values: string[] = this.getObjectValuesFromPredicate(INTEROP + "creatorAccessMode")!;
        return values.map(mode => getAccessmode(mode));
    }

    getAccessNecessity() {
        return this.getObjectValueFromPredicate(INTEROP + "accessNecessity")!;
    }

    getHasDataInstance() {
        return this.getObjectValuesFromPredicate(INTEROP + "hasDataInstance")!;
    }

    async getInheritsFromNeed(fetch: Fetch) {
        const inherit_uri = this.getObjectValueFromPredicate(INTEROP + "inheritsFromNeed")!;
        return await AccessNeed.getRdfDocument(inherit_uri, fetch);
    }
}
