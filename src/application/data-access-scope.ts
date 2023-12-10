import { AccessNeed, DataAuthorization, GrantScope } from "solid-interoperability";
import { AuthorizationBuilder } from "../builder/authorization-builder";

export abstract class DataAccessScope {
    constructor(public accessNeed: AccessNeed) {}

    abstract toDataAuthorization(builder: AuthorizationBuilder): Promise<DataAuthorization>;
}

export class DataAccessScopeAll extends DataAccessScope {
    constructor(accessNeed: AccessNeed) {
        super(accessNeed);
    }

    async toDataAuthorization(builder: AuthorizationBuilder): Promise<DataAuthorization> {
        return DataAuthorization.new(
            builder.generateId(),
            builder.authorizationAgent.session.fetch,
            builder.authorizationAgent.socialAgent,
            this.accessNeed.RegisteredShapeTree!,
            this.accessNeed,
            this.accessNeed.AccessModes,
            GrantScope.All,
            this.accessNeed.CreatorAccessModes,
        );
    }
}
