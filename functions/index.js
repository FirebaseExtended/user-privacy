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
// Paths for clearing and exporting data.
// All instances of `UID` in the JSON are replaced by the user's uid at runtime.
const userPrivacyPaths = require('./user_privacy.json');

admin.initializeApp(functions.config().firebase);

const db = admin.database();
const firestore = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;

// App-specific default bucket for storage. Used to upload exported json and in
// sample json of clearData and exportData paths.
const exportDataBucket = userPrivacyPaths.exportDataUploadBucket;

// The clearData function removes personal data from the RealTime Database,
// Storage, and Firestore. It waits for all deletions to complete, and then
// returns a success message.
//
// Triggered by a user deleting their account.
exports.clearData = functions.auth.user().onDelete((user) => {
  const uid = user.uid;

  const databasePromise = clearDatabaseData(uid);
  const storagePromise = clearStorageData(uid);
  const firestorePromise = clearFirestoreData(uid);

  return Promise.all([databasePromise, firestorePromise, storagePromise])
      .then(() => console.log(`Successfully removed data for user #${uid}.`)
  );
});

// Delete data from all specified paths from the Realtime Database. To add or
// remove a path, edit the `database[clearData]` array in `user_privacy.json`.
//
// This function is called by the top-level `clearData` function.
//
// Returns a list of Promises
const clearDatabaseData = (uid) => {
  const paths = userPrivacyPaths.database.clearData;
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

// Clear all specified files from the Realtime Database. To add or remove a
// path, edit the `storage[clearData]` array in `user_privacy.json`.
//
// This function is called by the top-level `clearData` function.
//
// Returns a list of Promises
const clearStorageData = (uid) => {
  const paths = userPrivacyPaths.storage.clearData;
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

// Clear all specified paths from the Firestore Database. To add or remove a
// path, edit the `firestore[clearData]` array in `user_privacy.json`.
//
// This function is called by the top-level `clearData` function.
//
// Returns a list of Promises
const clearFirestoreData = (uid) => {
  const paths = userPrivacyPaths.firestore.clearData;
  const promises = [];

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryCollection = replaceUID(entry.collection, uid);
    if ('doc' in entry) {
      const entryDoc = replaceUID(entry.doc, uid);
      const docToDelete = firestore.collection(entryCollection).doc(entryDoc);
      if ('field' in entry) {
        const entryField = replaceUID(entry.field, uid);
        const update = {};
        update[entryField] = FieldValue.delete();
        promises.push(docToDelete.update(update).catch((err) => {
          console.error('Error deleting field: ', err);
        }));
      } else if (docToDelete) {
        promises.push(docToDelete.delete().catch((err) => {
          console.error('Error deleting document: ', err);
        }));
      };
    } else {
      promises.push(
        firestore
          .collection(entryCollection)
          .get()
          .then(querySnapshot => {
            const deletionPromises = [];
            querySnapshot.forEach(docSnapshot => {
              deletionPromises.push(docSnapshot.ref.delete().catch((err) => {
                console.error('Error deleting document: ', err);
              }));
            });
            return Promise.all(deletionPromises);
          })
      );
    }
  };

  return Promise.all(promises).then(() => uid);
};

// The `exportData` function reads and copys data from the RealTime Database,
// Storage, and Firestore. It waits to complete reads for all three, and then
// uploads a JSON file of the exported data to storage and returns a success
// message.
//
// Because the resulting file will contain personal information, it's important
// to use Firebase Security Rules to make these files readable only by the user.
// See the `storage.rules` file for an example.
//
// Triggered by an http request.
exports.exportData = functions.https.onRequest((req, res) => {
  const body = JSON.parse(req.body);
  const uid = body.uid;
  const exportData = {};

  const databasePromise = exportDatabaseData(uid).then((databaseData) => {
    exportData.database = databaseData;
  });
  const firestorePromise = exportFirestoreData(uid).then((firestoreData) => {
    exportData.firestore = firestoreData;
  });
  const storagePromise = exportStorageData(uid).then((storageReferences) => {
    exportData.storage = storageReferences;
  });

  return Promise.all([databasePromise, firestorePromise, storagePromise])
      .then(() => {
        console.log(`Success! Completed export for user ${uid}.`);
        return uploadToStorage(uid, exportData);
      }).then(() => res.json({exportComplete: true}));
});

// Read and copy the specified paths from the RealTime Database. To add or
// remove a path, edit the `database[exportData]` array in `user_privacy.json`.
//
// This function is called by the top-level `exportData` function.
//
// Returns a Promise.
const exportDatabaseData = (uid) => {
  const paths = userPrivacyPaths.database.exportData;
  const promises = [];
  const exportData = {};

  for (let i = 0; i < paths.length; i++) {
    const path = replaceUID(paths[i], uid);
    promises.push(db.ref(path).once('value').then((snapshot) => {
      const read = snapshot.val();
      if (read !== null) {
        exportData[snapshot.key] = read;
      }
    }).catch((err) => {
      console.error('Error encountered while exporting Database data: ', err);
    }));
  };

  return Promise.all(promises).then(() => exportData);
};

// Read and copy the specified paths from the Firestore Database. To add or
// remove a path, edit the `firestore[exportData]` array in `user_privacy.json`.
//
// This function is called by the top-level `exportData` function.
//
// Returns a Promise.
const exportFirestoreData = (uid) => {
  const paths = userPrivacyPaths.firestore.exportData;
  const promises = [];
  const exportData = {};

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryCollection = entry.collection;
    const entryDoc = replaceUID(entry.doc, uid);
    const exportRef = firestore.collection(entryCollection).doc(entryDoc);
    const path = `${entryCollection}/${entryDoc}`;
    promises.push(exportRef.get().then((doc) => {
      if (doc.exists) {
        let read = doc.data();
        if ('field' in entry) {
          let entryField = replaceUID(entry.field, uid);
          path = `${path}/${entryField}`;
          read = read[entryField];
        }
        exportData[path] = read;
      }
    }).catch((err) => {
      console.error('Error encountered while exporting from firestore: ', err);
    }));
  };
  return Promise.all(promises).then(() => exportData);
};


// In the case of Storage, a read-only copy of each file is created, accessible
// only to the user, and a list of copied files is added to the final JSON. It's
// essential that the Firebase Security Rules for Storage restrict access of the
// copied files to the given user.
//
// This implementation works is designed for accounts on the free tier. To use
// multiple buckets, specify a desination bucket arg to the `copy` method.
//
// To add or remove a path, edit the `database[exportData]` array in
// `user_privacy.json`.
//
// This function is called by the top-level `exportData` function.
//
// Returns a Promise.
const exportStorageData = (uid) => {
  const paths = userPrivacyPaths.storage.exportData;
  const promises = [];
  const exportData = {};

  for (let i = 0; i < paths.length; i++) {
    const entry = paths[i];
    const entryBucket = replaceUID(entry[0], uid);
    const path = replaceUID(entry[1], uid);
    const sourceBucket = storage.bucket(entryBucket);
    const sourceFile = sourceBucket.file(path);

    const destinationPath = `exportData/${uid}/${path}`;

    let copyPromise = sourceFile.copy(destinationPath);
    // Make copyPromise succeed even if it fails:
    copyPromise = copyPromise.catch((err) =>
      console.log('There is an error copying the promise, but keep going.')
    );
    // Add the copy task to the array of Promises
    promises.push(copyPromise);
    exportData[`${entryBucket}/${path}`] = `${exportDataBucket}/${destinationPath}`;
  }
  return Promise.all(promises).then(() => exportData);
};

// Upload json to Storage, under a filename of the user's uid. This is the final
// result of the exportData function; because this file will contain personal
// information, it's important to use Firebase Security Rules to make these
// files readable only by the user with the same uid.
//
// Called by the top-level exportData function.
const uploadToStorage = (uid, exportedData) => {
  const json = JSON.stringify(exportedData);
  const bucket = storage.bucket(exportDataBucket);
  const file = bucket.file(`exportData/${uid}/export.json`);

  return file.save(json);
};

const replaceUID = (str, uid) => {
  return str.replace(/UID_VARIABLE/g, uid);
};
