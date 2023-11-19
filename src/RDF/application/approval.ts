import { AccessNeedGroup } from "./access-need-group";
import { ApplicationProfileDocument } from "./application-profile-document";
import { DataAccessScope } from "./data-access-scope";

export class Approval {
    constructor(public applicationProfileDocument: ApplicationProfileDocument, public access: Map<AccessNeedGroup, DataAccessScope[]>) {
        
    }
}