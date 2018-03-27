### What is this repository?

This is not an official Google product. This repo is an example of using Cloud
Functions for Firebase to protect user privacy. Specifically, it demonstrates
removing user data when they delete their account (the [`wipeout` function]())
and copying out data at when a user requests it (the [`takeout` function]()).
The functions are  flexible and easy to change to fit the needs of your specific
users and apps.


### How to use these functions in your own project

The `index.js` file has comments about how the functions work; this is about
how to wire it up.

The developer specifies the paths to data to wipeout or takeout. Those paths
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

#### Wipeout function

The wipeout function as written is triggered when a user deletes their account
using Firebase Auth, and it performs a wipeout from all three services.

Steps to start using wipeout:
- [ ] Include the wipeout function and 3 supporting functions (and the requires
  and convenience variables) in `functions/index.js`
- [ ] In `user_privacy.json`, add paths to personal information for all the
  products you’re using.
- [ ] Make sure you’ve added the ability for the user to delete their account,
  because that’s what triggers the function
- [ ] If you’re not using all three products, RTDB, Firestore, and Storage,
  remove the parts of the function that you don’t need.

The wipeout is implemented by collecting a promise for every
deletion event that needs to occur. Only when all promises resolve is the
wipeout considered complete. Keep that in mind if you send a confirmation
message that wipeout has completed.

#### Takeout function

The takeout function is triggered via a HTTP request. The sample app in
`/public` has a button that’s wired up to trigger takeout; in a more
traditional app, this could be in settings.

In order to start using it:

- [ ] Include the function and 4 supporting functions in `functions/index.js.`
- [ ] In `user_privacy.json`, add:
    - [ ] A ``"takeoutUploadBucket"`` key that maps to the name of your primary
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

#### Takeout rules

Adding Storage Rules to protect the takeout data is extremely important for
takeout; without Rules, the takeout data is broadly available. The `takeout`
function uploads to a top level `/takeout` folder, and the [Storage
Rules](https://github.com/firebase/user-privacy/blob/master/storage.rules#L3-L10
  ) restrict access to the specific user who requested takeout. To protect the
takeout data:
- [ ] Add the [Rules](https://github.com/firebase/user-privacy/blob/master/storage.rules#L3-L10)
for the takeout folder to the Storage Rules.
- [ ] Look through any preexisting Storage Rules; if a rule grants broader
access to the takeout data, update that rule. Remember that if one rule grants
access, another cannot restrict it.

### How to contribute to this repo

- [ ] Clone this repository
- [ ] Create a new firebase project and go through the `firebase init` flow.
This project uses Hosting, Functions, the RealTime Database, Firestore, and
Storage.
- [ ] `cd` into the `functions` directory and `npm install`
- [ ] Run `firebase deploy`
- [ ] Make the changes you're interested in
- [ ] Submit a Pull Request explaining the problem and solution.
