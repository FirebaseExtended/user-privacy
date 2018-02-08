const admin = require("firebase-admin");
const functions = require("firebase-functions");
// Paths for wipeout and takeout.
// All instances of `UID` in the JSON are replaced by the user's uid at runtime.
const user_privacy_paths = require("./user_privacy.json");

admin.initializeApp(functions.config().firebase);

const db = admin.database();
const firestore = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;

// App-specific default bucket for storage. Used to upload takeout json and in
// sample json of wipeout and takeout paths.
const appBucketName = "wipeout-takeout.appspot.com";

// Wipeout
//
// The wipeout function removes personal data from the RealTime Database,
// Storage, and Firestore. It waits for all deletions to complete, and then
// returns a success message.
//
// Triggered by a user deleting their account.
exports.wipeout = functions.auth.user().onDelete(event => {
  var uid = event.data.uid;

  var databasePromise = databaseWipeout(uid);
  var storagePromise = storageWipeout(uid);
  var firestorePromise = firestoreWipeout(uid);

  return Promise.all([databasePromise, firestorePromise, storagePromise]).then(function() {
    console.log(`Wipeout success! There's no trace of user #${uid}.`);
  });
});

// Delete data from all specified paths from the Realtime Database. To add or
// remove a path, edit the `database[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const databaseWipeout = (uid) => {
  var paths = user_privacy_paths.database.wipeout;
  var promises = [];

  for (let i = 0; i < paths.length; i++) {
    var path = paths[i].replace(/UID/g, uid);
    promises.push(db.ref(path).remove().catch(function(error) {
      // Avoid execution interuption.
      console.error("Error deleting path: ", error);
    }));
  }

  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Database wipeout complete for user with id ${uid}`);
    });
  });
};

// Wipeout all specified files from the Realtime Database. To add or remove a
// path, edit the `storage[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const storageWipeout = (uid) => {
  var paths = user_privacy_paths.storage.wipeout;
  var promises = [];

  for (let i = 0; i < paths.length; i++) {
    var bucketName = paths[i][0].replace(/UID/g, uid);
    var path = paths[i][1].replace(/UID/g, uid);
    var bucket = storage.bucket(bucketName);
    var file = bucket.file(path);
    promises.push(file.delete().catch(function(error) {
      console.error("Error deleting file: ", error);
    }));
  };

  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Storage wipeout complete for user with id ${uid}`);
    });
  });
};

// Wipeout all specified paths from the Firestore Database. To add or remove a
// path, edit the `firestore[wipeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const firestoreWipeout = (uid) => {
  var paths = user_privacy_paths.firestore.wipeout;
  var promises = [];

  for (let i = 0; i < paths.length; i++) {
    var entry = paths[i];
    var entryCollection = entry["collection"].replace(/UID/g, uid);
    var entryDoc = entry["doc"].replace(/UID/g, uid);
    var docToDelete = firestore.collection(entryCollection).doc(entryDoc);
    if("field" in entry) {
      entryField = entry["field"].replace(/UID/g, uid);
      promises.push(docToDelete.update({
        entryField: FieldValue.delete()
      }).catch(function(error){
        console.error("Error deleting field: ", error);
      }));
    } else {
      if (docToDelete) {
        promises.push(docToDelete.delete().catch(function(error) {
          console.error("Error deleting document: ", error);
        }));
      };
    };
  };

  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Firestore wipeout complete for user with id ${uid}`);
    });
  });
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
  var takeout = {};
  var uid = JSON.parse(req.body).uid;

  var databasePromise = databaseTakeout(uid).then(function(databaseData) {
    takeout["database"] = databaseData;
  });
  var firestorePromise = firestoreTakeout(uid).then(function(firestoreData) {
    takeout["firestore"] = firestoreData;
  });
  var storagePromise = storageTakeout(uid).then(function(storageReferences) {
    takeout["storage"] = storageReferences
  });

  return Promise.all([databasePromise, firestorePromise, storagePromise]).then(function() {
    console.log(`Success! Completed takeout for user ${uid}.`);
    return uploadToStorage(uid, takeout);
  }).then(() => res.json("{takeoutComplete: true}"));
});

// Read and copy the specified paths from the RealTime Database. To add or
// remove a path, edit the `database[takeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const databaseTakeout = (uid) => {
  var paths = user_privacy_paths.database.takeout;
  var promises = [];
  var takeout = {};

  for (let i = 0; i < paths.length; i++) {
    var path = paths[i].replace(/UID/g, uid);
    promises.push(
      db.ref(path)
      .once("value")
      .then(function(snapshot) {
        read = snapshot.val();
        if (read !== null) {
          takeout[snapshot.key] = read;
        }
      }).catch(err => {
        console.error("Error encountered during database takeout: ", err);
      }).then(new Promise(function(resolve, reject) {
        resolve(path);
      }))
    );
  };

  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(takeout);
    });
  });
};

// Read and copy the specified paths from the Firestore Database. To add or
// remove a path, edit the `firestore[takeout]` array in `user_privacy.json`.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const firestoreTakeout = (uid) => {
  var paths = user_privacy_paths.firestore.takeout;
  var promises = [];
  var takeout = {};

  for (let i = 0; i < paths.length; i++) {
    var entry = paths[i];
    var entryCollection = entry["collection"];
    var entryDoc =  entry["doc"].replace(/UID/g, uid);
    var takeoutRef = firestore.collection(entryCollection).doc(entryDoc);
    var path = `${entryCollection}/${entryDoc}`;
    promises.push(
      takeoutRef.get()
      .then(doc => {
        if (doc.exists){
          read = doc.data();
          if("field" in entry) {
            var entryField = entry["field"].replace(/UID/g, uid);
            read = read.field(entryField);
          }
          takeout[path] = read;
        }
      }).catch(err => {
        console.error("Error encountered during firestore takeout: ", err);
      }).then(new Promise(function(resolve, reject) {
        resolve(path);
      }))
    );
  }
  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(takeout);
    });
  });
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
  var paths = user_privacy_paths.storage.takeout;
  var takeout = {};

  for (let i = 0; i < paths.length; i++) {
    var entry = paths[i];
    var entryBucket = entry[0].replace(/UID/g, uid);
    var path = entry[1].replace(/UID/g, uid);
    var sourceBucket = storage.bucket(entryBucket);
    var sourceFile = sourceBucket.file(path);

    var destinationPath = `takeout/${uid}/${path}`;
    sourceFile.copy(destinationPath);
    takeout[`${entryBucket}/${path}`] = `${appBucketName}/${destinationPath}`;
  }
  return new Promise(function(resolve, reject) {
    resolve(takeout);
  });
};

// Upload json to Storage, under a filename of the user's uid. This is the final
// result of the takeout function, and because this file will contain personal
// information, it's important to use Firebase Security Rules to make these
// files readable only by the user with the same uid.
//
// Called by the top-level takeout function.
const uploadToStorage = (uid, takeout) => {
  var json = JSON.stringify(takeout);
  var bucket = storage.bucket(appBucketName);
  var file = bucket.file(`takeout/${uid}_takeout.json`);

  takeoutUpload = file.save(json);
};
