"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskEvent = {
    /** Triggered whenever the task changes or progress is updated. */
    STATE_CHANGED: 'state_changed'
};
exports.InternalTaskState = {
    RUNNING: 'running',
    PAUSING: 'pausing',
    PAUSED: 'paused',
    SUCCESS: 'success',
    CANCELING: 'canceling',
    CANCELED: 'canceled',
    ERROR: 'error'
};
exports.TaskState = {
    /** The task is currently transferring data. */
    RUNNING: 'running',
    /** The task was paused by the user. */
    PAUSED: 'paused',
    /** The task completed successfully. */
    SUCCESS: 'success',
    /** The task was canceled. */
    CANCELED: 'canceled',
    /** The task failed with an error. */
    ERROR: 'error'
};
function taskStateFromInternalTaskState(state) {
    switch (state) {
        case exports.InternalTaskState.RUNNING:
        case exports.InternalTaskState.PAUSING:
        case exports.InternalTaskState.CANCELING:
            return exports.TaskState.RUNNING;
        case exports.InternalTaskState.PAUSED:
            return exports.TaskState.PAUSED;
        case exports.InternalTaskState.SUCCESS:
            return exports.TaskState.SUCCESS;
        case exports.InternalTaskState.CANCELED:
            return exports.TaskState.CANCELED;
        case exports.InternalTaskState.ERROR:
            return exports.TaskState.ERROR;
        default:
            // TODO(andysoto): assert(false);
            return exports.TaskState.ERROR;
    }
}
exports.taskStateFromInternalTaskState = taskStateFromInternalTaskState;

//# sourceMappingURL=taskenums.js.map
