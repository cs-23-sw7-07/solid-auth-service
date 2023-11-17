import { IAccessApproval } from "../interfaces/IAccessApproval";

export class AccessApprovalHandler implements IAccessApproval {
  private isAccessGranted: boolean = true;
  requestAccessApproval(): boolean {
    return this.isAccessGranted;
  }
  setGrantingStatus(value: boolean){
    this.isAccessGranted = value;
  }
}
