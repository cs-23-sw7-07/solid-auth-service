import { DataAuthorization, GrantScope } from "solid-interoperability";
import { AccessNeed } from "./access-need";
import { AuthorizationBuilder } from "../builder/authorization-builder";

export abstract class DataAccessScope {
    constructor(public accessNeed: AccessNeed) {}

    abstract toDataAuthoization(builder: AuthorizationBuilder): Promise<DataAuthorization>;
}

export class DataAccessScopeAll extends DataAccessScope {
    constructor(accessNeed: AccessNeed) {
        super(accessNeed);
    }

    async toDataAuthoization(builder: AuthorizationBuilder): Promise<DataAuthorization> {
        return new DataAuthorization(
            builder.generateId(),
            builder.authorizationAgent.social_agent,
            this.accessNeed.getRegisteredShapeTree()!,
            this.accessNeed.getAccessModes(),
            GrantScope.All,
            this.accessNeed.uri,
            undefined,
            undefined,
            undefined,
            this.accessNeed.getCreatorAccessModes(),
        );
    }
}
