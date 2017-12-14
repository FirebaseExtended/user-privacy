var UploadTaskSnapshot = /** @class */ (function () {
    function UploadTaskSnapshot(bytesTransferred, totalBytes, state, metadata, task, ref) {
        this.bytesTransferred = bytesTransferred;
        this.totalBytes = totalBytes;
        this.state = state;
        this.metadata = metadata;
        this.task = task;
        this.ref = ref;
    }
    Object.defineProperty(UploadTaskSnapshot.prototype, "downloadURL", {
        get: function () {
            if (this.metadata !== null) {
                var urls = this.metadata['downloadURLs'];
                if (urls != null && urls[0] != null) {
                    return urls[0];
                }
                else {
                    return null;
                }
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });
    return UploadTaskSnapshot;
}());
export { UploadTaskSnapshot };

//# sourceMappingURL=tasksnapshot.js.map
