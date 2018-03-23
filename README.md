### What is this repository?

This is not an official Google product. This repo is an example of using Cloud
Functions for Firebase to protect user privacy. Specifically, it demonstrates
removing user data when they delete their account (the [`wipeout` function]())
and copying out data at when a user requests it (the [`takeout` function]()).
The functions are  flexible and easy to change to fit the needs of your specific
users and apps.

### How to contribute

- [ ] Clone this repository
- [ ] Create a new firebase project and go through the `firebase init` flow. This project uses Hosting, Functions, the RealTime Database, Firestore, and Storage.
- [ ] `cd` into the `functions` directory and `npm install`
- [ ] Run `firebase deploy`


### How to use these functions in your own project

The `index.js` file has comments about how the functions work; this is about
how to wire it up.

The developer specifies the paths to data to wipeout or takeout. Those paths live in `user_privacy.json`. The data structures vary for each of the products:
- For the RTDB, it’s a list of Strings to the path in the database of the form `"</users/uid/follows/..."`
- For Firestore, it’s a list of Objects of the form `{ "collection": "admins",
"doc": "UID_VARIABLE", "field": "email" }`.
- For Storage, it’s a list of Lists with two elements, a bucket name and file name of the form `["cool-project.appspot.com", "users/uid/avatar.jpg"]`

#### Wipeout function
The wipeout function as written is triggered when a user deletes their account
using firebase auth, and it performs a wipeout from all three services.

Steps to start using wipeout:
- [ ] Include the wipeout function and 3 supporting functions (and the requires and convenience variables) in `functions/index.js`
- [ ] In `user_privacy.json`, add paths to personal information for all the products you’re using.
- [ ] Make sure you’ve added the ability for the user to delete their account, because that’s what triggers the function
- [ ] If you’re not using all three products, RTDB, Firestore, and Storage, remove the parts of the function that you don’t need.

As an FYI, the wipeout is implemented by collecting a promise for every deletion event that needs to occur. Only when all promises resolve is the wipeout considered complete. Keep that in mind if you send a confirmation message that wipeout has completed.

#### Takeout function
The takeout function is triggered via a HTTP request. (The sample app in
  `/public` has a button that’s wired up to trigger takeout, but in a more
  traditional app, that would be in settings.)

In order to start using it:

- [ ] Include the function and 4 supporting functions in `functions/index.js.`
- [ ] In `user_privacy.json`, add:
  - [ ] A ``"takeoutUploadBucket"`` key that maps to the name of your primary bucket (or in the case of the free tier, your only bucket).
  - [ ] Paths to personal information for all the products you’re using.
- [ ] Wire it up in a way appropriate for your platform. For web, I added a
button in `public/index.html`, that triggers a POST request, and add a rewrite entry in `firebase.json` to trigger the function via HTTP.
- [ ] If you’re not using all three products, RTDB, Firestore, and Storage,
remove the parts of the function you don’t need.

Takeout for Storage is weird because we copy the data to a folder for that user, and also create the json of references.

The storage.rules additions are extremely important for takeout. Without them, all the takeout data is freely available. We next the final takeout output under `/takeout`, but check to make sure you don’t have have wildcards in your storage rules, that will also apply to the takeout section.
