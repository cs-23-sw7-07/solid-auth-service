import { Fetch, SocialAgent } from "solid-interoperability";
import { RdfDocument } from "../rdf-document";
import { INTEROP } from "../../namespace";
import { AccessNeedGroup } from "./access-need-group";

export class ApplicationProfileDocument extends RdfDocument{ 
    constructor(uri: string) {
        super(uri)
    }

    static async getRdfDocument(uri: string, fetch: Fetch): Promise<ApplicationProfileDocument>{
        return await RdfDocument.getRdfDocument(uri, fetch) as ApplicationProfileDocument
    }

    getApplicationName(): string {
        return this.getObjectValueFromPredicate(INTEROP + "applicationName")!;
    }

    getApplicationDescription(): string {
        return this.getObjectValueFromPredicate(INTEROP + "applicationDescription")!;
    }

    getApplicationAuthor(): string {
        return this.getObjectValueFromPredicate(INTEROP + "applicationAuthor")!;
    }

    getApplicationThumbnail(): SocialAgent {
        const webId = this.getObjectValueFromPredicate(INTEROP + "applicationThumbnail")!;
        return new SocialAgent(webId);
    }

    async gethasAccessNeedGroup(fetch: Fetch): Promise<AccessNeedGroup[]>{
        const values = this.getObjectValuesFromPredicate(INTEROP + "hasAccessNeedGroup")!;
        let groups: AccessNeedGroup[] = []
        for (const uri of values) {
            groups.push(await AccessNeedGroup.getRdfDocument(uri, fetch))
        }
        return groups;
    }

    getHasAuthorizationCallbackEndpoint(): string {
        return this.getObjectValueFromPredicate(INTEROP + "hasAuthorizationCallbackEndpoint")!;
    }
}

