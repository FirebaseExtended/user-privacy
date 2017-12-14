const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.database();

// RTDB Wipeout
//
// Customize database paths; all uses of `UID` will be replaced by the uid of
// the user whose data is being removed.
const databaseWipeoutPaths = [
  "/users/UID",
  "/admins/UID"
];

exports.databaseWipeout = functions.auth.user().onDelete(event => {
  // Specify database paths to all saved PII
  var deleteTasks = []
  console.log("user id: ", event.data.uid);
  for (let i = 0; i < databaseWipeoutPaths.length; i++) {
    var path = databaseWipeoutPaths[i].replace(/UID/g, event.data.uid);
    deleteTasks.push(db.ref(path).remove());
  }
  return Promise.all(deleteTasks).then(() => databaseWipeoutPaths);
});


// exports.databaseTakeout

// exports.storageWipeout

// exports.storageTakeout

// exports.firestoreWipeout

// exports.firestoreTakeout
