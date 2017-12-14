/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** Describes the online state of the Firestore client */
export var OnlineState;
(function (OnlineState) {
    /**
     * The Firestore client is in an unknown online state. This means the client
     * is either not actively trying to establish a connection or it was
     * previously in an unknown state and is trying to establish a connection.
     */
    OnlineState[OnlineState["Unknown"] = 0] = "Unknown";
    /**
     * The client is connected and the connections are healthy. This state is
     * reached after a successful connection and there has been at least one
     * succesful message received from the backends.
     */
    OnlineState[OnlineState["Healthy"] = 1] = "Healthy";
    /**
     * The client has tried to establish a connection but has failed.
     * This state is reached after either a connection attempt failed or a
     * healthy stream was closed for unexpected reasons.
     */
    OnlineState[OnlineState["Failed"] = 2] = "Failed";
})(OnlineState || (OnlineState = {}));

//# sourceMappingURL=types.js.map
