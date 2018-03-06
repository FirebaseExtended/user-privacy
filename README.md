### What is this repository?

This is not an official Google product. This repo is an example of using Cloud
Functions for Firebase to protect user privacy. Specifically, it demonstrates
removing user data when they delete their account (the [`wipeout` function]())
and copying out data at when a user requests it (the [`takeout` function]()).
The functions are  flexible and easy to change to fit the needs of your specific
users and apps.

### How to play with these functions

- [ ] Clone this repository
- [ ] Create a new firebase project and go through the `firebase init` flow.
This project uses Hosting, Functions, the RealTime Database, Firestore, and
Storage.
- [ ] `cd` into the `functions` directory and `npm install`
- [ ] Run `firebase deploy`
