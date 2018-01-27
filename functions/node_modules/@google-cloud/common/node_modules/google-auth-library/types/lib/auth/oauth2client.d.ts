/// <reference types="request" />
import * as request from 'request';
import { BodyResponseCallback } from './../transporters';
import { AuthClient } from './authclient';
import { Credentials } from './credentials';
import { LoginTicket } from './loginticket';
export interface GenerateAuthUrlOpts {
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string[] | string;
}
export declare class OAuth2Client extends AuthClient {
    private _redirectUri;
    private _certificateCache;
    private _certificateExpiry;
    protected _opts: any;
    _clientId: string;
    _clientSecret: string;
    apiKey: string;
    /**
     * Handles OAuth2 flow for Google APIs.
     *
     * @param {string=} clientId The authentication client ID.
     * @param {string=} clientSecret The authentication client secret.
     * @param {string=} redirectUri The URI to redirect to after completing the auth request.
     * @param {Object=} opt_opts optional options for overriding the given parameters.
     * @constructor
     */
    constructor(clientId?: string, clientSecret?: string, redirectUri?: string, opt_opts?: any);
    /**
     * The base URL for auth endpoints.
     */
    private static readonly GOOGLE_OAUTH2_AUTH_BASE_URL_;
    /**
     * The base endpoint for token retrieval.
     */
    private static readonly GOOGLE_OAUTH2_TOKEN_URL_;
    /**
     * The base endpoint to revoke tokens.
     */
    private static readonly GOOGLE_OAUTH2_REVOKE_URL_;
    /**
     * Google Sign on certificates.
     */
    private static readonly GOOGLE_OAUTH2_FEDERATED_SIGNON_CERTS_URL_;
    /**
     * Clock skew - five minutes in seconds
     */
    private static readonly CLOCK_SKEW_SECS_;
    /**
     * Max Token Lifetime is one day in seconds
     */
    private static readonly MAX_TOKEN_LIFETIME_SECS_;
    /**
     * The allowed oauth token issuers.
     */
    private static readonly ISSUERS_;
    /**
     * Generates URL for consent page landing.
     * @param {object=} opt_opts Options.
     * @return {string} URL to consent page.
     */
    generateAuthUrl(opt_opts?: GenerateAuthUrlOpts): string;
    /**
     * Gets the access token for the given code.
     * @param {string} code The authorization code.
     * @param {function=} callback Optional callback fn.
     */
    getToken(code: string, callback?: BodyResponseCallback): void;
    /**
     * Refreshes the access token.
     * @param {string} refresh_token Existing refresh token.
     * @param {function=} callback Optional callback.
     * @private
     */
    protected refreshToken(refresh_token: any, callback?: BodyResponseCallback): request.Request | void;
    /**
     * Retrieves the access token using refresh token
     *
     * @deprecated use getRequestMetadata instead.
     * @param {function} callback callback
     */
    refreshAccessToken(callback: (err: Error, credentials: Credentials, response?: request.RequestResponse) => void): void;
    /**
     * Get a non-expired access token, after refreshing if necessary
     *
     * @param {function} callback Callback to call with the access token
     */
    getAccessToken(callback: (err: Error, access_token: string, response?: request.RequestResponse) => void): void;
    /**
     * getRequestMetadata obtains auth metadata to be used by requests.
     *
     * getRequestMetadata is the main authentication interface.  It takes an
     * optional uri which when present is the endpoint being accessed, and a
     * callback func(err, metadata_obj, response) where metadata_obj contains
     * authorization metadata fields and response is an optional response object.
     *
     * In OAuth2Client, metadata_obj has the form.
     *
     * {Authorization: 'Bearer <access_token_value>'}
     *
     * @param {string} opt_uri the Uri being authorized
     * @param {function} metadataCb the func described above
     */
    getRequestMetadata(opt_uri: string, metadataCb: (err: Error, headers: any, response?: request.RequestResponse) => void): void | request.Request;
    /**
     * Revokes the access given to token.
     * @param {string} token The existing token to be revoked.
     * @param {function=} callback Optional callback fn.
     */
    revokeToken(token: string, callback?: BodyResponseCallback): void;
    /**
     * Revokes access token and clears the credentials object
     * @param  {Function=} callback callback
     */
    revokeCredentials(callback: BodyResponseCallback): void;
    /**
     * Provides a request implementation with OAuth 2.0 flow.
     * If credentials have a refresh_token, in cases of HTTP
     * 401 and 403 responses, it automatically asks for a new
     * access token and replays the unsuccessful request.
     * @param {object} opts Request options.
     * @param {function} callback callback.
     * @return {Request} Request object
     */
    request(opts?: any, callback?: BodyResponseCallback): void | request.Request;
    /**
     * Makes a request without paying attention to refreshing or anything
     * Assumes that all credentials are set correctly.
     * @param  {object}   opts     Options for request
     * @param  {Function} callback callback function
     * @return {Request}           The request object created
     */
    _makeRequest(opts: any, callback: BodyResponseCallback): request.Request;
    /**
     * Allows inheriting classes to inspect and alter the request result.
     * @param {object} err Error result.
     * @param {object} result The result.
     * @param {object} result The HTTP response.
     * @param {Function} callback The callback.
     * @private
     */
    protected postRequest(err: Error, result: any, response: request.RequestResponse, callback: BodyResponseCallback): void;
    /**
     * Verify id token is token by checking the certs and audience
     * @param {string} idToken ID Token.
     * @param {(string|Array.<string>)} audience The audience to verify against the ID Token
     * @param {function=} callback Callback supplying GoogleLogin if successful
     */
    verifyIdToken(idToken: string, audience: string | string[], callback: (err: Error, login?: LoginTicket) => void): void;
    /**
     * Gets federated sign-on certificates to use for verifying identity tokens.
     * Returns certs as array structure, where keys are key ids, and values
     * are PEM encoded certificates.
     * @param {function=} callback Callback supplying the certificates
     */
    getFederatedSignonCerts(callback: BodyResponseCallback): void;
    /**
     * Verify the id token is signed with the correct certificate
     * and is from the correct audience.
     * @param {string} jwt The jwt to verify (The ID Token in this case).
     * @param {array} certs The array of certs to test the jwt against.
     * @param {(string|Array.<string>)} requiredAudience The audience to test the jwt against.
     * @param {array} issuers The allowed issuers of the jwt (Optional).
     * @param {string} maxExpiry The max expiry the certificate can be (Optional).
     * @return {LoginTicket} Returns a LoginTicket on verification.
     */
    verifySignedJwtWithCerts(jwt: string, certs: any, requiredAudience: string | string[], issuers?: string[], maxExpiry?: number): LoginTicket;
    /**
     * This is a utils method to decode a base64 string
     * @param {string} b64String The string to base64 decode
     * @return {string} The decoded string
     */
    decodeBase64(b64String: string): string;
}
