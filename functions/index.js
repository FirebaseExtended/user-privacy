/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
// Paths for wipeout and takeout.
// All instances of `UID` in the JSON are replaced by the user's uid at runtime.
const userPrivacyPaths = require('./user_privacy.json');

admin.initializeApp(functions.config().firebase);

const db = admin.database();
const firestore = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;

// App-specific default bucket for storage. Used to upload takeout json and in
// sample json of wipeout and takeout paths.
const appBucketName = 'wipeout-takeout.appspot.com';

// Wipeout
//
// The wipeout function removes personal data from the RealTime Database,
// Storage, and Firestore. It waits for all deletions to complete, and then
// returns a success message.
//
// Triggered by a user deleting their account.
exports.wipeout = functions.auth.user().onDelete((event) => {
  const uid = event.data.uid;

  const databasePromise = databaseWipeout(uid);
  const storagePromise = storageWipeout(uid);
  const firestorePromise = firestoreWipeout(uid);

  return Promise.all([databasePromise, firestorePromise, storagePromise])
      .then(() => console.log(`Successfully removed data for user #${uid}.`)
  );
});

// Delete data from all specified paths from the Realtime Database. To add or
// remove a path, edit the `database[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const databaseWipeout = (uid) => {
  const paths = userPrivacyPaths.database.wipeout;
  const promises = [];

  for (let i = 0; i < paths.length; i++) {
    const path = replaceUID(paths[i], uid);
    promises.push(db.ref(path).remove().catch((error) => {
      // Avoid execution interuption.
      console.error('Error deleting data at path: ', path, error);
    }));
  }

  return Promise.all(promises).then(() => uid);
};

// Wipeout all specified files from the Realtime Database. To add or remove a
// path, edit the `storage[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const storageWipeout = (uid) => {
  const paths = userPrivacyPaths.storage.wipeout;
  const promises = [];

  for (let i = 0; i < paths.length; i++) {
    const bucketName = replaceUID(paths[i][0], uid);
    const path = replaceUID(paths[i][1], uid);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(path);
    promises.push(file.delete().catch((error) => {
      console.error('Error deleting file: ', path, error);
    }));
  };

  return Promise.all(promises).then(() => uid);
};

// Wipeout all specified paths from the Firestore Database. To add or remove a
// path, edit the `firestore[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const firestoreWipeout = (uid) => {
  const paths = userPrivacyPaths.firestore.wipeout;
  const promises = [];

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryCollection = replaceUID(entry.collection, uid);
    const entryDoc = replaceUID(entry.doc, uid);
    const docToDelete = firestore.collection(entryCollection).doc(entryDoc);
    if ('field' in entry) {
      const entryField = replaceUID(entry.field, uid);
      const update = {};
      update[entryField] = FieldValue.delete();
      primises.push(docToDelete.update(update).catch((err) => {
        console.error('Error deleting field: ', err);
      }));
    } else if (docToDelete) {
      promises.push(docToDelete.delete().catch((err) => {
        console.error('Error deleting document: ', err);
      }));
    };
  };

  return Promise.all(promises).then(() => uid);
};

// Takeout
//
// The `takeout` function reads and copys data from the RealTime Database,
// Storage, and Firestore. It waits to complete reads for all three, and then
// uploads a JSON file of the takeout data to storage and returns a success
// message.
//
// Because the resulting file will contain personal information, it's important
// to use Firebase Security Rules to make these files readable only by the user.
// See the `storage.rules` file for an example.
//
// Triggered by an http request.
exports.takeout = functions.https.onRequest((req, res) => {
  const body = JSON.parse(req.body);
  const uid = body.uid;
  const takeout = {};

  const databasePromise = databaseTakeout(uid).then((databaseData) => {
    takeout.database = databaseData;
  });
  const firestorePromise = firestoreTakeout(uid).then((firestoreData) => {
    takeout.firestore = firestoreData;
  });
  const storagePromise = storageTakeout(uid).then((storageReferences) => {
    takeout.storage = storageReferences;
  });

  return Promise.all([databasePromise, firestorePromise, storagePromise])
      .then(() => {
        console.log(`Success! Completed takeout for user ${uid}.`);
        return uploadToStorage(uid, takeout);
      }).then(() => res.json({takeoutComplete: true}));
});

// Read and copy the specified paths from the RealTime Database. To add or
// remove a path, edit the `database[takeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const databaseTakeout = (uid) => {
  const paths = userPrivacyPaths.database.takeout;
  const promises = [];
  const takeout = {};

  for (let i = 0; i < paths.length; i++) {
    const path = replaceUID(paths[i], uid);
    promises.push(db.ref(path).once('value').then((snapshot) => {
      const read = snapshot.val();
      if (read !== null) {
        takeout[snapshot.key] = read;
      }
    }).catch((err) => {
      console.error('Error encountered during database takeout: ', err);
    }));
  };

  return Promise.all(promises).then(() => takeout);
};

// Read and copy the specified paths from the Firestore Database. To add or
// remove a path, edit the `firestore[takeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const firestoreTakeout = (uid) => {
  const paths = userPrivacyPaths.firestore.takeout;
  const promises = [];
  const takeout = {};

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryCollection = entry.collection;
    const entryDoc = replaceUID(entry.doc, uid);
    const takeoutRef = firestore.collection(entryCollection).doc(entryDoc);
    const path = `${entryCollection}/${entryDoc}`;
    promises.push(takeoutRef.get().then((doc) => {
      if (doc.exists) {
        let read = doc.data();
        if ('field' in entry) {
          const entryField = replaceUID(entry.field, uid);
          path = `${path}/${entryField}`;
          read = read[entryField];
        }
        takeout[path] = read;
      }
    }).catch((err) => {
      console.error('Error encountered during firestore takeout: ', err);
    }));
  };
  return Promise.all(promises).then(() => takeout);
};


// In the case of Storage, a read-only copy of each file is created, accessible
// only to the user, and a list of copied files is added to the final JSON. It's
// essential that the Firebase Security Rules for Storage restrict access of the
// copied files to the given user.
//
// This implementation works is designed for accounts on the free tier. To use
// multiple buckets, specify a desination bucket arg to the `copy` method.
//
// To add or remove a path, edit the `database[takeout]` array in
// `user_privacy.json`.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const storageTakeout = (uid) => {
  const paths = userPrivacyPaths.storage.takeout;
  const promises = [];
  const takeout = {};

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryBucket = replaceUID(entry[0], uid);
    const path = replaceUID(entry[1], uid);
    const sourceBucket = storage.bucket(entryBucket);
    const sourceFile = sourceBucket.file(path);

    const destinationPath = `takeout/${uid}/${path}`;

    let copyPromise = sourceFile.copy(destinationPath);
    // Make copyPromise succeed even if it fails:
    copyPromise = copyPromise.catch((err) =>
      console.log('There is an error copying the promise, but keep going.')
    );
    // Add the copy task to the array of Promises
    promises.push(copyPromise);
    takeout[`${entryBucket}/${path}`] = `${appBucketName}/${destinationPath}`;
  }
  return Promise.all(promises).then(() => takeout);
};

// Upload json to Storage, under a filename of the user's uid. This is the final
// result of the takeout function, and because this file will contain personal
// information, it's important to use Firebase Security Rules to make these
// files readable only by the user with the same uid.
//
// Called by the top-level takeout function.
const uploadToStorage = (uid, takeout) => {
  const json = JSON.stringify(takeout);
  const bucket = storage.bucket(appBucketName);
  const file = bucket.file(`takeout/${uid}/takeout.json`);

  return file.save(json);
};

const replaceUID = (str, uid) => {
  return str.replace(/UID_VARIABLE/g, uid);
};
