import { ErrorFactory } from '@firebase/util';
export default class DBInterface {
    private dbName_;
    private dbVersion_;
    private openDbPromise_;
    protected errorFactory_: ErrorFactory<string>;
    protected TRANSACTION_READ_WRITE: IDBTransactionMode;
    /**
     * @param {string} dbName
     * @param {number} dbVersion
     */
    constructor(dbName: any, dbVersion: any);
    /**
     * Get the indexedDB as a promsie.
     * @protected
     * @return {!Promise<!IDBDatabase>} The IndexedDB database
     */
    openDatabase(): Promise<IDBDatabase>;
    /**
     * Close the currently open database.
     * @return {!Promise} Returns the result of the promise chain.
     */
    closeDatabase(): Promise<void>;
    /**
     * @protected
     * @param {!IDBDatabase} db
     */
    onDBUpgrade(db: any): void;
}
