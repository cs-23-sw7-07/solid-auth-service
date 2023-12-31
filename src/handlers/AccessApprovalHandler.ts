import { AccessNeedGroup, Agent } from "solid-interoperability";
import { IAccessApproval } from "../interfaces/IAccessApproval";
import { Approval } from "../application/approval";
import { DataAccessScope } from "../application/data-access-scope";

export class AccessApprovalHandler implements IAccessApproval {
    private isAccessGranted: boolean = true;

    requestAccessApproval(): boolean {
        return this.isAccessGranted;
    }
    setGrantingStatus(value: boolean) {
        this.isAccessGranted = value;
    }
    getApprovalStatus(agent: Agent, access: Map<AccessNeedGroup, DataAccessScope[]>): Approval {
        if (this.isAccessGranted) return new Approval(agent, access);
        else throw Error("Undefined approval status.");
    }
}
