import { DataAuthorization, DataRegistration, GrantScope } from "solid-interoperability";
import { AccessNeed } from "./access-need";
import { AuthorizationBuilder } from "../builder/authorization-builder";

export abstract class DataAccessScope {
    constructor(public accessNeed: AccessNeed) {

    }

    abstract toDataAuthoization(builder: AuthorizationBuilder): Promise<DataAuthorization>
}

class DataAccessScopeAll extends DataAccessScope {
    constructor(accessNeed: AccessNeed, public dataOwnerWebId: string) {
        super(accessNeed)
    }
    // const data_registrations: DataRegistration[] = await builder.authorizationAgent.getAllDataRegistrations();
    async toDataAuthoization(builder: AuthorizationBuilder): Promise<DataAuthorization> {
        return new DataAuthorization(
                builder.newId(),
                builder.authorizationAgent.social_agent,
                this.accessNeed.getRegisteredShapeTree(),
                this.accessNeed.getAccessModes(),
                GrantScope.All,
                this.accessNeed.uri,
                undefined,
                undefined,
                this.accessNeed.getCreatorAccessModes(),
            )
    }
}
