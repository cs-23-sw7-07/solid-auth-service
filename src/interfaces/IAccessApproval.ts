/**
 * The interface is used to deterem the status of the authorization request
 * @function
 * requestAccessApproval
 * 
 * @remarks
 * You can replace the logic inside the requestAccessApproval method with your own 
 * criteria for determining access approval when inheriting the interface.
 */
export interface IAccessApproval {
    requestAccessApproval(): boolean;
}
