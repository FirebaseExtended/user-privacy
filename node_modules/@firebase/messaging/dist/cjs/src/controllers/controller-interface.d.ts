import TokenManager from '../models/token-manager';
export default class ControllerInterface {
    app: any;
    INTERNAL: any;
    protected errorFactory_: any;
    private messagingSenderId_;
    private tokenManager_;
    /**
     * An interface of the Messaging Service API
     * @param {!firebase.app.App} app
     */
    constructor(app: any);
    /**
     * @export
     * @return {Promise<string> | Promise<null>} Returns a promise that
     * resolves to an FCM token.
     */
    getToken(): Promise<any>;
    /**
     * This method deletes tokens that the token manager looks after and then
     * unregisters the push subscription if it exists.
     * @export
     * @param {string} token
     * @return {Promise<void>}
     */
    deleteToken(token: any): Promise<boolean>;
    getSWRegistration_(): Promise<ServiceWorkerRegistration>;
    requestPermission(): void;
    /**
     * @export
     * @param {!ServiceWorkerRegistration} registration
     */
    useServiceWorker(registration: any): void;
    /**
     * @export
     * @param {!firebase.Observer|function(*)} nextOrObserver
     * @param {function(!Error)=} optError
     * @param {function()=} optCompleted
     * @return {!function()}
     */
    onMessage(nextOrObserver: any, optError: any, optCompleted: any): void;
    /**
     * @export
     * @param {!firebase.Observer|function()} nextOrObserver An observer object
     * or a function triggered on token refresh.
     * @param {function(!Error)=} optError Optional A function
     * triggered on token refresh error.
     * @param {function()=} optCompleted Optional function triggered when the
     * observer is removed.
     * @return {!function()} The unsubscribe function for the observer.
     */
    onTokenRefresh(nextOrObserver: any, optError: any, optCompleted: any): void;
    /**
     * @export
     * @param {function(Object)} callback
     */
    setBackgroundMessageHandler(callback: any): void;
    /**
     * This method is required to adhere to the Firebase interface.
     * It closes any currently open indexdb database connections.
     */
    delete(): Promise<void>;
    /**
     * Returns the current Notification Permission state.
     * @private
     * @return {string} The currenct permission state.
     */
    getNotificationPermission_(): any;
    /**
     * @protected
     * @returns {TokenManager}
     */
    getTokenManager(): TokenManager;
}
