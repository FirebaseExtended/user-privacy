import ControllerInterface from './controller-interface';
export default class WindowController extends ControllerInterface {
    private registrationToUse_;
    private manifestCheckPromise_;
    private messageObserver_;
    private onMessage_;
    private tokenRefreshObserver_;
    private onTokenRefresh_;
    /**
     * A service that provides a MessagingService instance.
     * @param {!firebase.app.App} app
     */
    constructor(app: any);
    /**
     * This method returns an FCM token if it can be generated.
     * The return promise will reject if the browser doesn't support
     * FCM, if permission is denied for notifications or it's not
     * possible to generate a token.
     * @export
     * @return {Promise<string> | Promise<null>} Returns a promise the
     * resolves to an FCM token or null if permission isn't granted.
     */
    getToken(): any;
    /**
     * The method checks that a manifest is defined and has the correct GCM
     * sender ID.
     * @private
     * @return {Promise} Returns a promise that resolves if the manifest matches
     * our required sender ID
     */
    manifestCheck_(): any;
    /**
     * Request permission if it is not currently granted
     * @export
     * @returns {Promise} Resolves if the permission was granted, otherwise
     * rejects
     */
    requestPermission(): Promise<void> | Promise<{}>;
    /**
     * This method allows a developer to override the default service worker and
     * instead use a custom service worker.
     * @export
     * @param {!ServiceWorkerRegistration} registration The service worker
     * registration that should be used to receive the push messages.
     */
    useServiceWorker(registration: any): void;
    /**
     * @export
     * @param {!firebase.Observer|function(*)} nextOrObserver An observer object
     * or a function triggered on message.
     * @param {function(!Error)=} optError Optional A function triggered on
     * message error.
     * @param {function()=} optCompleted Optional function triggered when the
     * observer is removed.
     * @return {!function()} The unsubscribe function for the observer.
     */
    onMessage(nextOrObserver: any, optError: any, optCompleted: any): any;
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
    onTokenRefresh(nextOrObserver: any, optError: any, optCompleted: any): any;
    /**
     * Given a registration, wait for the service worker it relates to
     * become activer
     * @private
     * @param  {ServiceWorkerRegistration} registration Registration to wait
     * for service worker to become active
     * @return {Promise<!ServiceWorkerRegistration>} Wait for service worker
     * registration to become active
     */
    waitForRegistrationToActivate_(registration: any): Promise<ServiceWorkerRegistration>;
    /**
     * This will regiater the default service worker and return the registration
     * @private
     * @return {Promise<!ServiceWorkerRegistration>} The service worker
     * registration to be used for the push service.
     */
    getSWRegistration_(): Promise<ServiceWorkerRegistration>;
    /**
     * This method will set up a message listener to handle
     * events from the service worker that should trigger
     * events in the page.
     *
     * @private
     */
    setupSWMessageListener_(): void;
    /**
     * Checks to see if the required API's are valid or not.
     * @private
     * @return {boolean} Returns true if the desired APIs are available.
     */
    isSupported_(): boolean;
}
