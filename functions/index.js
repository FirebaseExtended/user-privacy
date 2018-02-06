const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp(functions.config().firebase);

const db = admin.database();
const firestore = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;

// App-specific default bucket for storage. Used to upload takeout json and in
// sample json of wipeout and takeout paths.
const bucketName = "wipeout-takeout.appspot.com";

// Wipeout
//
// The wipeout function kicks off functions to start removing personal data from
// the RealTime Database, Storage, and Firestore. It waits for all three
// functions to complete, and then returns a success message. Triggered by a
// user deleting their account.
exports.wipeout = functions.auth.user().onDelete(event => {
  var uid = event.data.uid;

  var databasePromise = databaseWipeout(uid);
  var storagePromise = storageWipeout(uid);
  var firestorePromise = firestoreWipeout(uid);

  return Promise.all([databasePromise, firestorePromise, storagePromise]).then(function() {
    console.log(`Wipeout success! There's no trace of user #${uid}.`)
  })
});

// Delete data from all specified paths from the Realtime Database. To add or
// remove a path, edit the `database[wipeout]` array in user_privacy_paths.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const databaseWipeout = (uid) => {
  const databaseWipeoutPaths = user_privacy_paths.database.wipeout;
  var databasePromises = [];

  for (let i = 0; i < databaseWipeoutPaths.length; i++) {
    var path = databaseWipeoutPaths[i].replace(/UID/g, uid);
    databasePromises.push(db.ref(path).remove().catch(function(error) {
      // Catching the errors is important because if a path doesn't exist, the
      // returned error will interupt execution.
      console.error("Error deleting path: ", error)
    }));
  }

  return Promise.all(databasePromises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Database wipeout complete for user with id ${uid}`)
    });
  })
};

// Wipeout all specified files from the Realtime Database. To add or remove a
// path, edit the `storage[wipeout]` array in user_privacy_paths.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const storageWipeout = (uid) => {
  const storageWipeoutPaths = user_privacy_paths.storage.wipeout;
  var storagePromises = []

  for (let i = 0; i < storageWipeoutPaths.length; i++) {
    var bucketName = storageWipeoutPaths[i][0].replace(/UID/g, uid);
    var path = storageWipeoutPaths[i][1].replace(/UID/g, uid);
    var bucket = storage.bucket(bucketName);
    var file = bucket.file(path);
    storagePromises.push(file.delete().catch(function(error) {
      console.error("Error deleting file: ", error);
    }));
  };

  return Promise.all(storagePromises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Storage wipeout complete for user with id ${uid}`)
    });
  })
};

// Wipeout all specified paths from the Firestore Database. To add or remove a
// path, edit the `firestore[wipeout]` array in user_privacy_paths.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a list of Promises
const firestoreWipeout = (uid) => {
  const firestoreWipeoutPaths = user_privacy_paths.firestore.wipeout;
  var firestorePromises = [];

  for (let i = 0; i < firestoreWipeoutPaths.length; i++) {
    var entry = firestoreWipeoutPaths[i]
    var entryCollection = entry["collection"].replace(/UID/g, uid);
    var entryDoc = entry["doc"].replace(/UID/g, uid);
    var docToDelete = firestore.collection(entryCollection).doc(entryDoc);
    if("field" in entry) {
      entryField = entry["field"].replace(/UID/g, uid);
      firestorePromises.push(docToDelete.update({
        entryField: FieldValue.delete()
      }).catch(function(error){
        console.error("Error deleting field: ", error);
      }));
    } else {
      if (docToDelete) {
        firestorePromises.push(docToDelete.delete().catch(function(error) {
          console.error("Error deleting document: ", error);
        }));
      };
    }
  };

  return Promise.all(firestorePromises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(`Firestore wipeout complete for user with id ${uid}`)
    });
  })
};

// Takeout
//
// The `takeout` function kicks off functions to start reading and copying data
// from the RealTime Database, Storage, and Firestore. It waits for all three
// functions to complete, and then returns a success message and uploads a
// JSON file of the takeout data to storage.
//
// Because the resulting takeout file could contain personal information, it's
// important to use Firebase Security Rules to make these files readable only by
// the user with the same uid.
//
// Triggered by an http function, which could be wired up to a button or link.
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
    console.log(`Success! Completed takeout for user ${uid}:`, takeout)
    return uploadToStorage(uid, takeout)
  }).then(() => res.json("{takeoutComplete: true}"));
});

// Read and copy the specified paths from the RealTime Database. To add or
// remove a path, edit the `database[takeout]` array in user_privacy_paths.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const databaseTakeout = (uid) => {
  const databaseTakeoutPaths = user_privacy_paths.database.takeout;
  var promises = [];
  var databaseTakeout = {};

  for (let i = 0; i < databaseTakeoutPaths.length; i++) {
    var path = databaseTakeoutPaths[i].replace(/UID/g, uid);
    promises.push(
      db.ref(path)
      .once("value")
      .then(function(snapshot) {
        read = snapshot.val()
        console.log("db read: ", read);
        if (read !== null) {
          databaseTakeout[snapshot.key] = read;
        }
      }).catch(err => {
        console.log("Error encountered during database takeout: ", err);
      }).then(new Promise(function(resolve, reject) {

        resolve(path);
      }))
    );
  };

  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(databaseTakeout)
    });
  })
};

// Read and copy the specified paths from the Firestore Database. To add or
// remove a path, edit the `firestore[takeout]` array in user_privacy_paths.
//
// This function is called by the top-level `takeout` function.
//
// Returns a Promise.
const firestoreTakeout = (uid) => {
  const firestoreTakeoutPaths = user_privacy_paths.firestore.takeout;
  var promises = [];
  var firestoreTakeout = {};

  for (let i = 0; i < firestoreTakeoutPaths.length; i++) {
    var entry = firestoreTakeoutPaths[i]
    var entryCollection = entry["collection"];
    var entryDoc =  entry["doc"].replace(/UID/g, uid);
    var takeoutRef = firestore.collection(entryCollection).doc(entryDoc);
    var path = `${entryCollection}/${entryDoc}`

    promises.push(
      takeoutRef.get()
      .then(doc => {
        read = doc.data();
        if (read !== null) {
          firestoreTakeout[path] = doc.data();
        }
      }).catch(err => {
        console.log(err)
      }).then(new Promise(function(resolve, reject) {
        resolve(path);
      }))
    );
  }
  return Promise.all(promises).then(function() {
    return new Promise(function(resolve, reject) {
      resolve(firestoreTakeout);
    });
  })
};

// In the case of Storage, a read-only copy of each file is created, accessible
// only to the user, and a list of copied files is added to the final JSON.
//
// It's essential in either implementation that the Firebase Security Rules for
// Storage account for these files and restrict access to the given user.

// Read and copy the specified paths from Firebase Storage. To add or
// remove a path, edit the `database[takeout]` array in user_privacy_paths.
//
// This function is called by the top-level `wipeout` function.
//
// Returns a Promise.
const storageTakeout = (uid) => {
  const storageTakeoutPaths = user_privacy_paths.storage.takeout;
  var storageTakeout = {};

  for (let i = 0; i < storageTakeoutPaths.length; i++) {
    var entry = storageTakeoutPaths[i];
    var bucketName = entry[0].replace(/UID/g, uid);
    var path = entry[1].replace(/UID/g, uid);
    var sourceBucket = storage.bucket(bucketName);
    var sourceFile = sourceBucket.file(path);

    // Copy the asset that the app uses, to a new location that the security
    // rules make only accessible to the user.
    sourceFile.copy(`takeout/${uid}/${path}`);

    // Create a list of storage assets to include in the takeout JSON.
    storageTakeout[`${bucketName}/${path}`] = `${bucketName}/takeout/${uid}/${path}`;
  }
  return new Promise(function(resolve, reject) {
    resolve(storageTakeout);
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
  var bucket = storage.bucket(bucketName);
  var file = bucket.file(`takeout/${uid}_takeout.json`);

  return file.save(json);
};

// A list of paths that should be removed when a user deletes their account, or
// read and copied when a user requests a copy of their data.
//
// All instances of `UID` will be replaced by the uid of the user at runtime.
const user_privacy_paths = {
  "database": {
    "wipeout": [
      "/users/UID",
      "/admins/UID"
    ],
    "takeout": [
      "/users/UID",
      "/admins/UID"
    ]
  },
  "firestore": {
    "wipeout": [
      {"collection": "users", "doc": "UID", "field": "name"},
      {"collection": "users", "doc": "UID"},
      {"collection": "admins", "doc": "UID"}
    ],
    "takeout": [
      {"collection": "users", "doc": "UID", "field": "name"},
      {"collection": "users", "doc": "UID"},
      {"collection": "admins", "doc": "UID"}
    ]
  },
  "storage": {
    "wipeout": [
      [bucketName, "UID/sample_data.json"],
      [bucketName, "UID/copy_of_sample_data.json"],
      [bucketName, "UID"]
    ],
    "takeout": [
      [bucketName, "UID/sample_data.json"],
      [bucketName, "UID/copy_of_sample_data.json"],
      [bucketName, "UID"]
    ]
  }
}
