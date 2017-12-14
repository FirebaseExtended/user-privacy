import { Reference } from './Reference';
import { Repo } from '../core/Repo';
import { FirebaseApp, FirebaseService } from '@firebase/app';
/**
 * Class representing a firebase database.
 * @implements {FirebaseService}
 */
export declare class Database implements FirebaseService {
    private repo_;
    INTERNAL: DatabaseInternals;
    private root_;
    static readonly ServerValue: {
        TIMESTAMP: {
            '.sv': string;
        };
    };
    /**
     * The constructor should not be called by users of our public API.
     * @param {!Repo} repo_
     */
    constructor(repo_: Repo);
    readonly app: FirebaseApp;
    /**
     * Returns a reference to the root or the path specified in opt_pathString.
     * @param {string=} pathString
     * @return {!Reference} Firebase reference.
     */
    ref(pathString?: string): Reference;
    /**
     * Returns a reference to the root or the path specified in url.
     * We throw a exception if the url is not in the same domain as the
     * current repo.
     * @param {string} url
     * @return {!Reference} Firebase reference.
     */
    refFromURL(url: string): Reference;
    /**
     * @param {string} apiName
     */
    private checkDeleted_(apiName);
    goOffline(): void;
    goOnline(): void;
}
export declare class DatabaseInternals {
    database: Database;
    /** @param {!Database} database */
    constructor(database: Database);
    /** @return {Promise<void>} */
    delete(): Promise<void>;
}
