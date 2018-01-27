/// <reference types="node" />
import * as stream from 'stream';
export declare class JWTAccess {
    email: string;
    key: string;
    projectId: string;
    /**
     * JWTAccess service account credentials.
     *
     * Create a new access token by using the credential to create a new JWT token
     * that's recognized as the access token.
     *
     * @param {string=} email the service account email address.
     * @param {string=} key the private key that will be used to sign the token.
     * @constructor
     */
    constructor(email?: string, key?: string);
    /**
     * Indicates whether the credential requires scopes to be created by calling
     * createdScoped before use.
     *
     * @return {boolean} always false
     */
    createScopedRequired(): boolean;
    /**
     * Get a non-expired access token, after refreshing if necessary
     *
     * @param {string} authURI the URI being authorized
     * @param {function} metadataCb a callback invoked with the jwt
     *                   request metadata.
     */
    getRequestMetadata(authURI: string, metadataCb: (err: Error, headers?: any) => void): void;
    /**
     * Create a JWTAccess credentials instance using the given input options.
     * @param {object=} json The input object.
     * @param {function=} callback Optional callback.
     */
    fromJSON(json: any, callback?: (err: Error) => void): void;
    /**
     * Create a JWTAccess credentials instance using the given input stream.
     * @param {object=} stream The input stream.
     * @param {function=} callback Optional callback.
     */
    fromStream(stream: stream.Readable, callback?: (err: Error) => void): void;
    /**
     * Sign the JWT object, returning any errors in the callback.
     *
     * signedJwtFn is a callback function(err, signedJWT); it is called with an
     * error if there is an exception during signing.
     *
     * @param  {object}   assertion   The assertion to sign
     * @param  {Function} signedJwtFn  fn(err, signedJWT)
     */
    private _signJWT(assertion, signedJwtFn);
}
