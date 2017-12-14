import ControllerInterface from './controller-interface';
export default class SWController extends ControllerInterface {
    private bgMessageHandler_;
    constructor(app: any);
    /**
     * A handler for push events that shows notifications based on the content of
     * the payload.
     *
     * The payload must be a JSON-encoded Object with a `notification` key. The
     * value of the `notification` property will be used as the NotificationOptions
     * object passed to showNotification. Additionally, the `title` property of the
     * notification object will be used as the title.
     *
     * If there is no notification data in the payload then no notification will be
     * shown.
     * @private
     */
    onPush_(event: any): void;
    /**
     * @private
     */
    onSubChange_(event: any): void;
    /**
     * @private
     */
    onNotificationClick_(event: any): void;
    /**
     * @private
     * @param {Object} msgPayload
     * @return {NotificationOptions|undefined}
     */
    getNotificationData_(msgPayload: any): any;
    /**
     * Calling setBackgroundMessageHandler will opt in to some specific
     * behaviours.
     * 1.) If a notification doesn't need to be shown due to a window already
     * being visible, then push messages will be sent to the page.
     * 2.) If a notification needs to be shown, and the message contains no
     * notification data this method will be called
     * and the promise it returns will be passed to event.waitUntil.
     * If you do not set this callback then all push messages will let and the
     * developer can handle them in a their own 'push' event callback
     * @export
     * @param {function(Object)} callback The callback to be called when a push
     * message is received and a notification must be shown. The callback will
     * be given the data from the push message.
     */
    setBackgroundMessageHandler(callback: any): void;
    /**
     * @private
     * @param {string} url The URL to look for when focusing a client.
     * @return {Object} Returns an existing window client or a newly opened
     * WindowClient.
     */
    getWindowClient_(url: any): any;
    /**
     * This message will attempt to send the message to a window client.
     * @private
     * @param {Object} client The WindowClient to send the message to.
     * @param {Object} message The message to send to the client.
     * @returns {Promise} Returns a promise that resolves after sending the
     * message. This does not guarantee that the message was successfully
     * received.
     */
    attemptToMessageClient_(client: any, message: any): Promise<{}>;
    /**
     * @private
     * @returns {Promise<boolean>} If there is currently a visible WindowClient,
     * this method will resolve to true, otherwise false.
     */
    hasVisibleClients_(): any;
    /**
     * @private
     * @param {Object} msgPayload The data from the push event that should be sent
     * to all available pages.
     * @returns {Promise} Returns a promise that resolves once the message
     * has been sent to all WindowClients.
     */
    sendMessageToWindowClients_(msgPayload: any): any;
    /**
     * This will register the default service worker and return the registration.
     * @private
     * @return {Promise<!ServiceWorkerRegistration>} The service worker
     * registration to be used for the push service.
     */
    getSWRegistration_(): Promise<any>;
}
