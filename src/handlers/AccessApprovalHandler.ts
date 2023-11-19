import { GrantScope } from "solid-interoperability";
import { IAccessApproval } from "../interfaces/IAccessApproval";

export class AccessApprovalHandler implements IAccessApproval {
  getAccessScope(): GrantScope {
    return GrantScope.All;
  }
  private isAccessGranted: boolean = true;
  requestAccessApproval(): boolean {
    return this.isAccessGranted;
  }
  setGrantingStatus(value: boolean){
    this.isAccessGranted = value;
  }
}
