import DBInterface from './db-interface';
export default class VapidDetailsModel extends DBInterface {
    constructor();
    static readonly dbName: string;
    /**
     * @override
     * @param {IDBDatabase} db
     */
    onDBUpgrade(db: any): void;
    /**
     * Given a service worker scope, this method will look up the vapid key
     * in indexedDB.
     * @param {string} swScope
     * @return {Promise<string>} The vapid key associated with that scope.
     */
    getVapidFromSWScope(swScope: any): Promise<{}>;
    /**
     * Save a vapid key against a swScope for later date.
     * @param  {string} swScope The service worker scope to be associated with
     * this push subscription.
     * @param {string} vapidKey The public vapid key to be associated with
     * the swScope.
     * @return {Promise<void>}
     */
    saveVapidDetails(swScope: any, vapidKey: any): Promise<{}>;
    /**
     * This method deletes details of the current FCM VAPID key for a SW scope.
     * @param {string} swScope Scope to be deleted
     * @return {Promise<string>} Resolves once the scope / vapid details have been
     * deleted and returns the deleted vapid key.
     */
    deleteVapidDetails(swScope: any): Promise<{}>;
}
