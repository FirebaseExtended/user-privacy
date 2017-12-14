import DBInterface from './db-interface';
export default class TokenDetailsModel extends DBInterface {
    constructor();
    static readonly dbName: string;
    /**
     * @override
     */
    onDBUpgrade(db: any): void;
    /**
     * This method takes an object and will check for known arguments and
     * validate the input.
     * @private
     * @param {!ValidateInput} input
     * @return {!Promise} Returns promise that resolves if input is valid,
     * rejects otherwise.
     */
    validateInputs_(input: any): Promise<void>;
    /**
     * Given a token, this method will look up the details in indexedDB.
     * @param {string} fcmToken
     * @return {Promise<Object>} The details associated with that token.
     */
    getTokenDetailsFromToken(fcmToken: any): Promise<{}>;
    /**
     * Given a service worker scope, this method will look up the details in
     * indexedDB.
     * @public
     * @param {string} swScope
     * @return {Promise<Object>} The details associated with that token.
     */
    getTokenDetailsFromSWScope(swScope: any): Promise<{}>;
    /**
     * Save the details for the fcm token for re-use at a later date.
     * @param {{swScope: !string, vapidKey: !string,
     * subscription: !PushSubscription, fcmSenderId: !string, fcmToken: !string,
     * fcmPushSet: !string}} input A plain js object containing args to save.
     * @return {Promise<void>}
     */
    saveTokenDetails({swScope, vapidKey, subscription, fcmSenderId, fcmToken, fcmPushSet}: {
        swScope: any;
        vapidKey: any;
        subscription: any;
        fcmSenderId: any;
        fcmToken: any;
        fcmPushSet: any;
    }): Promise<{}>;
    /**
     * This method deletes details of the current FCM token.
     * It's returning a promise in case we need to move to an async
     * method for deleting at a later date.
     * @param {string} token Token to be deleted
     * @return {Promise<Object>} Resolves once the FCM token details have been
     * deleted and returns the deleted details.
     */
    deleteToken(token: any): Promise<{}>;
}
