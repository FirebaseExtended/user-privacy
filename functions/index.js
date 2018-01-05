const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);
const db = admin.database();
const fs = require('fs');

const bucketName = "wipeout-takeout.appspot.com"

// RTDB Wipeout
//
// Specify paths to all stored PII.
//
// All instances of `UID` will be replaced by the uid of the user at runtime.
const databaseWipeoutPaths = [
  "/users/UID",
  "/admins/UID"
];

exports.databaseWipeout = functions.auth.user().onDelete(event => {
  var deletePromises = [];
  for (let i = 0; i < databaseWipeoutPaths.length; i++) {
    var path = databaseWipeoutPaths[i].replace(/UID/g, event.data.uid);
    deletePromises.push(db.ref(path).remove());
  }
  return Promise.all(deletePromises).then(() => databaseWipeoutPaths);
});


// RTDB Takeout
//
// Specify database paths to all user content to be copied for Takeout.
//
// All instances of `UID` will be replaced by the user's UID at runtime.
const databaseTakeoutPaths = [
  "/users/UID/name",
  "/users/UID/email",
  "/users/UID/photo"
];

exports.databaseTakeout = functions.https.onRequest((req, res) => {
  var takeoutPromises = [];
  var takeout = {};
  var body = JSON.parse(req.body);
  var uid = body.uid;

  for (let i = 0; i < databaseTakeoutPaths.length; i++) {
    var path = databaseTakeoutPaths[i].replace(/UID/g, uid);
    takeoutPromises.push(db.ref(path).once("value").then(function(snapshot) {
      takeout[snapshot.key] = snapshot.val();
    }));
  }
  return Promise.all(takeoutPromises).then(function() {
    return uploadToStorage(uid, takeout);
  }).then(() => res.json({uploadComplete: true}));
});

const uploadToStorage = (uid, takeout) => {
  var json = JSON.stringify(takeout);
  var bucket = admin.storage().bucket(bucketName);
  var file = bucket.file(`${uid}.json`);

  return file.save(json);
};

// exports.storageWipeout

// exports.storageTakeout

// exports.firestoreWipeout

// exports.firestoreTakeout
