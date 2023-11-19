import { DataAuthorization, DataRegistration, GrantScope } from "solid-interoperability";
import { AccessNeed } from "./access-need";
import { DataAuthorizationBuilder } from "../builder/data-authorizations-builder";

export abstract class DataAccessScope {
    constructor(public accessNeed: AccessNeed) {

    }

    abstract toDataAuthoization(builder: DataAuthorizationBuilder): Promise<DataAuthorization[]>
}

class DataAccessScopeAll extends DataAccessScope {
    constructor(accessNeed: AccessNeed, public dataOwnerWebId: string) {
        super(accessNeed)
    }

    async toDataAuthoization(builder: DataAuthorizationBuilder): Promise<DataAuthorization[]> {
        const data_registrations: DataRegistration[] = await builder.authorizationAgent.getAllDataRegistrations();
        return data_registrations.map(data_registration =>
            new DataAuthorization(
                builder.newId(),
                builder.authorizationAgent.social_agent,
                this.accessNeed.getRegisteredShapeTree(),
                this.accessNeed.getAccessModes(),
                GrantScope.All,
                this.accessNeed.uri,
                undefined,
                data_registration,
                undefined,
                this.accessNeed.getCreatorAccessModes(),
            ))
    }
}
