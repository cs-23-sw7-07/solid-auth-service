import { ApplicationAgent, DataAuthorization, GrantScope } from "solid-interoperability";
import { ApplicationProfileDocument } from "../RDF/application/application-profile-document";
import { AccessNeed } from "../RDF/application/access-need";


    export function createDataAuthorizations(
        applicationProfile: ApplicationProfileDocument, 
        accessNeed: AccessNeed, 
        scopeOfAuthorization: GrantScope, 
        agent: AuthorizationAgent): DataAuthorization[] {
        const shapeTree = accessNeed.getRegistratedShapeTree();
        return new DataAuthorization(
            id,
            agent.social_agent,
            new ApplicationAgent(applicationProfile.webId),
            shapeTree,
            agent.getDataRegistration(shapeTree),
            accessNeed.getAccessModes(),
            scopeOfAuthorization,
            accessNeed.id,
            undefined,
            accessNeed.getCreatorAccessMode(),
            accessNeed.
        );
        }