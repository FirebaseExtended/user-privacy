export default class TokenManager {
    private errorFactory_;
    private openDbPromise_;
    static DB_NAME: 'fcm_token_details_db';
    constructor();
    /**
     * Get the indexedDB as a promsie.
     * @private
     * @return {Promise<IDBDatabase>} The IndexedDB database
     */
    openDatabase_(): Promise<IDBDatabase>;
    /**
     * Close the currently open database.
     * @return {Promise<?>} Returns the result of the promise chain.
     */
    closeDatabase(): Promise<void>;
    /**
     * Given a token, this method will look up the details in indexedDB.
     * @public
     * @param {string} fcmToken
     * @return {Promise<Object>} The details associated with that token.
     */
    getTokenDetailsFromToken(fcmToken: any): Promise<{}>;
    getTokenDetailsFromSWScope_(swScope: any): Promise<{}>;
    getAllTokenDetailsForSenderId_(senderId: any): Promise<Array<Object>>;
    /**
     * Given a PushSubscription and messagingSenderId, get an FCM token.
     * @public
     * @param  {string} senderId The 'messagingSenderId' to tie the token to.
     * @param  {PushSubscription} subscription The PushSusbcription to "federate".
     * @param  {string=} pushSet If defined this will swap the subscription for
     * matching FCM token.
     * @return {Promise<!Object>} Returns the FCM token to be used in place
     * of the PushSubscription.
     */
    subscribeToFCM(senderId: any, subscription: any, pushSet?: any): Promise<Object>;
    /**
     * Checks the that fields in the PushSubscription are equivalent to the
     * details stores in the masterTokenDetails.
     * @private
     * @param  {PushSubscription} subscription The push subscription we expect
     * the master token to match.
     * @param  {Object}  masterTokenDetails The saved details we wish to compare
     * with the PushSubscription
     * @return {boolean} true if the subscription and token details are
     * equivalent.
     */
    isSameSubscription_(subscription: any, masterTokenDetails: any): boolean;
    /**
     * Save the details for the fcm token for re-use at a later date.
     * @private
     * @param  {string} senderId The 'messagingSenderId' used for this project
     * @param  {ServiceWorkerRegistration} swRegistration The service worker
     * used to subscribe the user for web push
     * @param  {PushSubscription} subscription The push subscription passed to
     * FCM for the current token.
     * @param  {string} fcmToken The FCM token currently used on this
     * device.
     * @param  {string} fcmPushSet The FCM push tied to the fcm token.
     * @return {Promise<void>}
     */
    saveTokenDetails_(senderId: any, swRegistration: any, subscription: any, fcmToken: any, fcmPushSet: any): Promise<{}>;
    /**
     * Returns the saved FCM Token if one is available and still valid,
     * otherwise `null` is returned.
     * @param {string} senderId This should be the sender ID associated with the
     * FCM Token being retrieved.
     * @param {ServiceWorkerRegistration} swRegistration Registration to be used
     * to subscribe the user to push.
     * @return {Promise<string> | Promise} Returns the saved FCM Token if
     * avilable and valid.
     * @export
     */
    getSavedToken(senderId: any, swRegistration: any): Promise<any>;
    /**
     * Creates a new FCM token.
     */
    createToken(senderId: any, swRegistration: any): Promise<String>;
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
