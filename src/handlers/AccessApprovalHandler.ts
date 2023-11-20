import { GrantScope } from "solid-interoperability";
import { IAccessApproval } from "../interfaces/IAccessApproval";
import { Approval } from "../application/approval";
import { ApplicationProfileDocument } from "../profile-documents/application-profile-document";
import { AccessNeedGroup } from "../application/access-need-group";
import { DataAccessScope } from "../application/data-access-scope";

export class AccessApprovalHandler implements IAccessApproval {
  getAccessScope(): GrantScope {
    return GrantScope.All;
  }
  private isAccessGranted: boolean = true;

  requestAccessApproval(): boolean {
    return this.isAccessGranted;
  }
  setGrantingStatus(value: boolean) {
    this.isAccessGranted = value;
  }
  getApprovalStatus(
    applicationProfileDocument: ApplicationProfileDocument,
    access: Map<AccessNeedGroup, DataAccessScope[]>,
  ): Approval {
    if (this.isAccessGranted)
      return new Approval(applicationProfileDocument, access);
    else throw Error("Undefined approval status.");
  }
}
