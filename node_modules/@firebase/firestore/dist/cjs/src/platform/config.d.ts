import { FirebaseNamespace } from '@firebase/app';
/**
 * Configures Firestore as part of the Firebase SDK by calling registerService.
 */
export declare function configureForFirebase(firebase: FirebaseNamespace): void;
/**
 * Exports the Firestore namespace into the provided `exportObject` object under
 * the key 'firestore'. This is used for wrapped binary that exposes Firestore
 * as a goog module.
 */
export declare function configureForStandalone(exportObject: {
    [key: string]: {};
}): void;
