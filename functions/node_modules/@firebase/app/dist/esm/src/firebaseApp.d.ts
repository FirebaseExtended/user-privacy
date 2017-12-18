/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Observer, Subscribe } from '@firebase/util';
import { FirebaseError } from '@firebase/util';
export interface FirebaseAuthTokenData {
    accessToken: string;
}
export interface FirebaseAppInternals {
    getToken(refreshToken?: boolean): Promise<FirebaseAuthTokenData | null>;
    getUid(): string | null;
    addAuthTokenListener(fn: (token: string | null) => void): void;
    removeAuthTokenListener(fn: (token: string | null) => void): void;
}
export declare type FirebaseOptions = {
    apiKey?: string;
    authDomain?: string;
    databaseURL?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    [name: string]: any;
};
export interface FirebaseApp {
    /**
     * The (read-only) name (identifier) for this App. '[DEFAULT]' is the default
     * App.
     */
    name: string;
    /**
     * The (read-only) configuration options from the app initialization.
     */
    options: FirebaseOptions;
    /**
     * Make the given App unusable and free resources.
     */
    delete(): Promise<void>;
    INTERNAL: FirebaseAppInternals;
}
export interface FirebaseServiceInternals {
    /**
     * Delete the service and free it's resources - called from
     * app.delete().
     */
    delete(): Promise<void>;
}
export interface FirebaseService {
    app: FirebaseApp;
    INTERNAL?: FirebaseServiceInternals;
}
export declare type AppHook = (event: string, app: FirebaseApp) => void;
/**
 * Firebase Services create instances given a Firebase App instance and can
 * optionally add properties and methods to each FirebaseApp via the extendApp()
 * function.
 */
export interface FirebaseServiceFactory {
    (app: FirebaseApp, extendApp?: (props: {
        [prop: string]: any;
    }) => void, instanceString?: string): FirebaseService;
}
/**
 * All ServiceNamespaces extend from FirebaseServiceNamespace
 */
export interface FirebaseServiceNamespace<T extends FirebaseService> {
    (app?: FirebaseApp): T;
}
export interface FirebaseErrorFactory<T> {
    create(code: T, data?: {
        [prop: string]: any;
    }): FirebaseError;
}
export interface FirebaseErrorFactoryClass {
    new (service: string, serviceName: string, errors: {
        [code: string]: string;
    }): FirebaseErrorFactory<any>;
}
export interface FirebaseNamespace {
    /**
     * Create (and intialize) a FirebaseApp.
     *
     * @param options Options to configure the services use in the App.
     * @param name The optional name of the app to initialize ('[DEFAULT]' if
     *   none)
     */
    initializeApp(options: FirebaseOptions, name?: string): FirebaseApp;
    app: {
        /**
         * Retrieve an instance of a FirebaseApp.
         *
         * Usage: firebase.app()
         *
         * @param name The optional name of the app to return ('[DEFAULT]' if none)
         */
        (name?: string): FirebaseApp;
        /**
         * For testing FirebaseApp instances:
         *   app() instanceof firebase.app.App
         * DO NOT call this constuctor directly (use firebase.app() instead).
         */
        App: Function;
    };
    /**
     * A (read-only) array of all the initialized Apps.
     */
    apps: FirebaseApp[];
    Promise: typeof Promise;
    SDK_VERSION: string;
    INTERNAL: {
        /**
         * Internal API to register a Firebase Service into the firebase namespace.
         *
         * Each service will create a child namespace (firease.name) which acts as
         * both a namespace for service specific properties, and also as a service
         * accessor function (firebase.name() or firebase.name(app)).
         *
         * @param name The Firebase Service being registered.
         * @param createService Factory function to create a service instance.
         * @param serviceProperties Properties to copy to the service's namespace.
         * @param appHook All appHooks called before intializeApp returns to caller.
         * @param allowMultipleInstances Whether the registered service supports
         *   multiple instances per app. If not specified, the default is false.
         */
        registerService(name: string, createService: FirebaseServiceFactory, serviceProperties?: {
            [prop: string]: any;
        }, appHook?: AppHook, allowMultipleInstances?: boolean): FirebaseServiceNamespace<FirebaseService>;
        /**
         * Just used for testing to start from a fresh namespace.
         */
        createFirebaseNamespace(): FirebaseNamespace;
        /**
         * Internal API to install properties on the top-level firebase namespace.
         * @prop props The top level properties of this object are copied to the
         *   namespace.
         */
        extendNamespace(props: {
            [prop: string]: any;
        }): void;
        /**
         * Create a Subscribe function.  A proxy Observer is created so that
         * events can be sent to single Observer to be fanned out automatically.
         */
        createSubscribe<T>(executor: (observer: Observer<T>) => void, onNoObservers?: (observer: Observer<T>) => void): Subscribe<T>;
        /**
         * Utility exposed for internal testing.
         */
        deepExtend(target: any, source: any): any;
        /**
         * Internal API to remove an app from the list of registered apps.
         */
        removeApp(name: string): void;
        /**
         * Service factories for each registered service.
         */
        factories: {
            [name: string]: FirebaseServiceFactory;
        };
        useAsService(app: FirebaseApp, serviceName: string): string | null;
        /**
         * Use to construct all thrown FirebaseError's.
         */
        ErrorFactory: FirebaseErrorFactoryClass;
    };
}
/**
 * Return a firebase namespace object.
 *
 * In production, this will be called exactly once and the result
 * assigned to the 'firebase' global.  It may be called multiple times
 * in unit tests.
 */
export declare function createFirebaseNamespace(): FirebaseNamespace;
