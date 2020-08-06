### What is this repository?

This is not an official Google product. This repo is an example of using Cloud
Functions for Firebase to protect user privacy. Specifically, it demonstrates
removing user data from specific services (Realtime Database, Firestore, and 
Storage) when they delete their account (the [`clearData` function]())
and copying out data at when a user requests it (the [`exportData` function]()).
The functions are  flexible and easy to change to fit the needs of your specific
users and apps.

### Status

![Status: Archived](https://img.shields.io/badge/Status-Archived-red)

This sample is no longer actively maintained and is left here for reference only.

### How to use these functions in your own project

The `index.js` file has comments about how the functions work; this is about
how to wire it up.

The developer specifies the paths to data to clear or export. Those paths
live in `user_privacy.json`. The data structures vary for each of the products:
* For the RTDB, it’s a list of Strings to the path in the database of the form
`"/users/uid/follows/..."`
* For Firestore, it’s a list of Objects of the form:
```json
{
    "collection": "admins",
    "doc": "UID_VARIABLE",
    "field": "email"
}
```
* For Storage, it’s a list of Lists with two elements, a bucket name and file
name of the form:
```json
["cool-project.appspot.com", "users/uid/avatar.jpg"]
```

#### clearData function

The clearData function as written is triggered when a user deletes their account
using Firebase Auth, and it performs a deletion from all three services.

**Steps to start using clearData:**

- [ ] Include the clearData function and 3 supporting functions (and the
  `require`s and convenience variables) in `functions/index.js`
- [ ] In `user_privacy.json`, add paths to personal information for all the
  products you’re using.
- [ ] Make sure you’ve added the ability for the user to delete their account,
  because that’s what triggers the function
- [ ] If you’re not using all three products, RTDB, Firestore, and Storage,
  remove the parts of the function that you don’t need.

Clearing the data is implemented by collecting a promise for every
deletion event that needs to occur. Only when all promises resolve is the
clear considered complete. Keep that in mind if you send a confirmation
message that the data has been removed.

#### exportData function

The exportData function is triggered via a HTTP request. The sample app in
`/public` has a button that’s wired up to trigger a data export; in a
traditional app, this could be in settings.

**In order to start using it:**

- [ ] Include the function and 4 supporting functions in `functions/index.js.`
- [ ] In `user_privacy.json`, add:
    - [ ] A ``"exportDataUploadBucket"`` key that maps to the name of your primary
    bucket (or in the case of the free tier, your only bucket).
    - [ ] Paths to personal information for all the products you’re using.
- [ ] Trigger the function via HTTP request, in a way appropriate for your
platform. In the sample web app, a button in `public/index.html` makes a POST
request and a rewrite entry in `firebase.json` reroutes the request to the
function.
- [ ] If you’re not using all three products, RTDB, Firestore, and Storage,
remove the parts of the function you don’t need.

For Realtime Database and Firestore we write the user data into a JSON
document. For Storage we write a JSON document containing an index of stored
files, and copy the files themselves into a folder.

#### Security rules for exported data

Adding Storage Rules to protect the exported data is extremely important;
without Rules, the exported data could be broadly available. The `clearData`
function uploads to a top level `/exportData` folder, and the [Storage
Rules](https://github.com/firebase/user-privacy/blob/master/storage.rules#L3-L10
  ) restrict access to the specific user who requested export. To protect the
exported data:
- [ ] Add the [Rules](https://github.com/firebase/user-privacy/blob/master/storage.rules#L3-L10)
for the exportData folder to the Storage Rules.
- [ ] Look through any preexisting Storage Rules; if a rule grants broader
access to the exported data, update that rule. Remember that if one rule grants
access, another cannot restrict it.

### How to contribute to this repo

- [ ] Fork and clone this repository
- [ ] Create a new firebase project and go through the `firebase init` flow.
This project uses Hosting, Functions, the RealTime Database, Firestore, and
Storage.
- [ ] `cd` into the `functions` directory and `npm install`
- [ ] Run `firebase deploy`
- [ ] Make the changes you're interested in
- [ ] Submit a Pull Request explaining the problem and solution.
