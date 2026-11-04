// Generated from openapi.json by api-types.test.ts. Run `pnpm generate` to update; do not edit.

export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Check that the service is up */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The service is up. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Health"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rolls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every roll, ordered by roll number
         * @description A roll whose roll.json can't be read is listed under `unreadable`, with what's wrong, rather than failing the list.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The rolls. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RollList"];
                    };
                };
            };
        };
        put?: never;
        /** Create an empty roll */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRollRequest"];
                };
            };
            responses: {
                /** @description The new roll. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Roll"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A roll with that roll number already exists. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rolls/{rollId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a roll with its frames and versions */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The roll. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Roll"];
                    };
                };
                /** @description No roll has that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /**
         * Delete a roll
         * @description Deletes the roll with its frames (D38). Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The roll's whole folder moves into the archive's deleted/ folder; nothing is lost.
         */
        delete: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The roll was deleted. */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description There is no roll with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Change a roll's details
         * @description Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateRollRequest"];
                };
            };
            responses: {
                /** @description The updated roll. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Roll"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description There is no roll with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/rolls/{rollId}/frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a frame with no versions to a roll */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateFrameRequest"];
                };
            };
            responses: {
                /** @description The new frame. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Frame"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No roll has that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        /**
         * Delete many frames together
         * @description As when frames are selected. Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The frames' files and JSON move into the archive's deleted/ folder; nothing is lost. Nothing is deleted if any frame isn't in the roll. The response's ETag is the roll's new version.
         */
        delete: {
            parameters: {
                query: {
                    frameIds: string;
                };
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The frames were deleted. */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description No such roll, or a frame not in it. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Change many frames in one save
         * @description Their numbers, as when renumbering a roll, or the same details of their own for each, as when frames are selected and set together. Frames not listed are left alone. Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateFrameNumbersRequest"] | components["schemas"]["UpdateFrameDetailsRequest"];
                };
            };
            responses: {
                /** @description The roll, with its frames changed. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Roll"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such roll, or a frame not in it. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a frame
         * @description Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The frame's files and JSON move into the archive's deleted/ folder; nothing is lost. The response's ETag is the roll's new version.
         */
        delete: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                    frameId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The frame was deleted. */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description The roll has no frame with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Change a frame's number or the version shown for it
         * @description Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                    frameId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateFrameRequest"];
                };
            };
            responses: {
                /** @description The updated frame. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Frame"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has no frame with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload a lab scan as a new version of a frame
         * @description The body is the JPEG itself. It is stored unchanged.
         */
        post: {
            parameters: {
                query: {
                    /** @description The scan's original file name, kept when it's stored. */
                    file: string;
                };
                header?: never;
                path: {
                    rollId: string;
                    frameId: string;
                };
                cookie?: never;
            };
            /** @description The scan. */
            requestBody: {
                content: {
                    "image/jpeg": Blob;
                };
            };
            responses: {
                /** @description The new version. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Version"];
                    };
                };
                /** @description The roll has no frame with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The same scan is already in the roll, in the frame given. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            frameId: string;
                        };
                    };
                };
                /** @description The file is larger than 200 MB. */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not a JPEG. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid, the file could not be read as an image, or it has more than 100 megapixels. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"] | components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download a version's original file */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    rollId: string;
                    frameId: string;
                    versionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The original, unchanged. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "image/jpeg": Blob;
                    };
                };
                /** @description No such version. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}/details": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a frame's resolved details */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    rollId: string;
                    frameId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The frame’s details, each with where it came from. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FrameDetails"];
                    };
                };
                /** @description The roll has no frame with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}/versions/{versionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Turn a version
         * @description Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The version's file is never changed; only how it's shown. The response's ETag is the roll's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The roll's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    rollId: string;
                    frameId: string;
                    versionId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateVersionRequest"];
                };
            };
            responses: {
                /** @description The updated version. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Version"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The frame has no version with that ID. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The roll has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/thumbnail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a thumbnail of a version */
        get: {
            parameters: {
                query: {
                    /** @description small fits within 400 px, large within 2048 px. */
                    size: "small" | "large";
                    /** @description Degrees to turn it clockwise (D41). */
                    rotate?: "0" | "90" | "180" | "270";
                };
                header?: never;
                path: {
                    rollId: string;
                    frameId: string;
                    versionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A WebP that fits within the size. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "image/webp": Blob;
                    };
                };
                /** @description No such version. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/equipment/cameras": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the cameras */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Every camera, ordered by name. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CameraList"];
                    };
                };
            };
        };
        put?: never;
        /** Add a camera */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateCameraRequest"];
                };
            };
            responses: {
                /** @description The new camera. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Camera"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A camera with the same slug already exists. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/equipment/films": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the film stocks */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Every film stock, ordered by make and name. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FilmStockList"];
                    };
                };
            };
        };
        put?: never;
        /** Add a film stock */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateFilmStockRequest"];
                };
            };
            responses: {
                /** @description The new film stock. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FilmStock"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A film stock with the same slug already exists. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/equipment/lenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the lenses */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Every lens, ordered by make, name, focal length and aperture. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LensList"];
                    };
                };
            };
        };
        put?: never;
        /** Add a lens */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateLensRequest"];
                };
            };
            responses: {
                /** @description The new lens. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Lens"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A lens with the same slug already exists. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the events */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Every event, newest first; undated events last. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventList"];
                    };
                };
            };
        };
        put?: never;
        /** Add an event */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateEventRequest"];
                };
            };
            responses: {
                /** @description The new event. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Event"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description An event with the same slug already exists. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an event
         * @description The response's ETag is the event's version, for If-Match.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    slug: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The event. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Event"];
                    };
                };
                /** @description There is no event with that slug. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The slug is not a slug. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change an event's name or date
         * @description Send the event's ETag as If-Match: the change is refused if the event has changed since. The response's ETag is the event's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The event's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path: {
                    slug: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateEventRequest"];
                };
            };
            responses: {
                /** @description The updated event. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Event"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description There is no event with that slug. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The event has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the archive's details
         * @description The response's ETag is the archive's version, for If-Match.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The archive's details. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Archive"];
                    };
                };
                /** @description The archive isn't set up yet. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Set the archive up */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateArchiveRequest"];
                };
            };
            responses: {
                /** @description The archive, set up. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Archive"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The archive is already set up. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change the archive's author or copyright
         * @description Send the archive's ETag as If-Match: the change is refused if the archive has changed since. The response's ETag is the archive's new version.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The archive's ETag, from when it was read. */
                    "if-match"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateArchiveRequest"];
                };
            };
            responses: {
                /** @description The archive, changed. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Archive"];
                    };
                };
                /** @description The body is not valid JSON. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The archive isn't set up yet. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The archive has changed since it was read. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The body is not of the expected type. */
                415: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The request is invalid. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InvalidRequest"];
                    };
                };
                /** @description If-Match is missing. */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Health: {
            /** @enum {string} */
            status: "ok";
        };
        RollList: {
            rolls: components["schemas"]["Roll"][];
            unreadable: components["schemas"]["UnreadableRoll"][];
        };
        Roll: {
            /** @example 01M6EAAP694BKWR9HZ4N5Z54XD */
            id: string;
            /**
             * @description The year the roll was shot and a number, YYYY-NNN.
             * @example 2026-014
             */
            roll: string;
            /**
             * @description A name for the roll, or null.
             * @example Iceland, first day
             */
            name: string | null;
            notes: string | null;
            /** @example 2026-09-14 */
            shot: string | null;
            /**
             * @description The slug of the event the roll was shot at, or null.
             * @example nikon-fe
             */
            event: string | null;
            /**
             * @description The slug of the camera the roll was shot on, or null.
             * @example nikon-fe
             */
            camera: string | null;
            /**
             * @description The slug of the film stock the roll is, or null.
             * @example nikon-fe
             */
            film: string | null;
            /**
             * @description The slug of the lens the roll was shot with, or null.
             * @example nikon-fe
             */
            lens: string | null;
            frames: components["schemas"]["Frame"][];
        };
        Frame: {
            /** @example 01M6EAAP694BKWR9HZ4N5Z54XD */
            id: string;
            /**
             * @description The frame number, or null if not known yet.
             * @example 12A
             */
            number: string | null;
            /** @example Mill pond, early fog */
            title: string | null;
            /** @description 1 to 5 stars, or null for none (D39). */
            rating: number | null;
            notes: string | null;
            /**
             * @description The frame's own camera, in place of its roll's, or null to use the roll's.
             * @example nikon-fe
             */
            camera: string | null;
            /** @example nikon-fe */
            film: string | null;
            /** @example nikon-fe */
            lens: string | null;
            /** @description The events the frame is in, in place of its roll's, or null to use the roll's. */
            events: string[] | null;
            /**
             * @description The version shown for the frame, or null for its newest.
             * @example 01M6EAAP694BKWR9HZ4N5Z54XD
             */
            defaultVersion: string | null;
            versions: components["schemas"]["Version"][];
        };
        /** @description One image file of a frame. */
        Version: {
            /** @example 01M6EAAP694BKWR9HZ4N5Z54XD */
            id: string;
            /**
             * @description Where the file is, relative to the roll's folder.
             * @example frames/S9WDVXNP/9PMYF63D/12340014.jpg
             */
            file: string;
            sha256: string;
            bytes: number;
            width: number;
            height: number;
            /** Format: date-time */
            added: string;
            /** @description Degrees clockwise: 0, 90, 180 or 270. */
            rotate: 0 | 90 | 180 | 270;
        };
        UnreadableRoll: {
            /**
             * @description The roll's folder name, which should be its roll number.
             * @example 2026-014
             */
            folder: string;
            /** @description What's wrong with its roll.json, for a person to fix. */
            problem: string;
        };
        /** @description What went wrong, for a person to read. */
        Error: {
            error: string;
        };
        /** @description Each problem with the request: where it is and what is wrong. */
        InvalidRequest: {
            /** @enum {string} */
            error: "invalid request";
            issues: {
                path: (string | number)[];
                message: string;
            }[];
        };
        CreateRollRequest: {
            /**
             * @description The year the roll was shot and a number, YYYY-NNN.
             * @example 2026-014
             */
            roll: string;
            name?: string;
            notes?: string;
            /** @example 2026-09-14 */
            shot?: string;
            /** @example nikon-fe */
            event?: string;
            /** @example nikon-fe */
            camera?: string;
            /** @example nikon-fe */
            film?: string;
            /** @example nikon-fe */
            lens?: string;
        };
        /** @description The details to change. A detail left out stays as it is; null clears it. */
        UpdateRollRequest: {
            name?: string | null;
            notes?: string | null;
            /** @example 2026-09-14 */
            shot?: string | null;
            /** @example nikon-fe */
            event?: string | null;
            /** @example nikon-fe */
            camera?: string | null;
            /** @example nikon-fe */
            film?: string | null;
            /** @example nikon-fe */
            lens?: string | null;
        };
        CreateFrameRequest: {
            /** @example 12A */
            number?: string;
        };
        UpdateFrameNumbersRequest: {
            numbers: {
                /** @example 01M6EAAP694BKWR9HZ4N5Z54XD */
                frameId: string;
                /**
                 * @description The new frame number, or null to clear it.
                 * @example 12A
                 */
                number: string | null;
            }[];
        };
        /** @description Gives every frame listed the same camera, film stock, lens or events of its own. A detail left out stays as each frame has it; null goes back to the roll's. */
        UpdateFrameDetailsRequest: {
            frameIds: string[];
            /** @example nikon-fe */
            camera?: string | null;
            /** @example nikon-fe */
            film?: string | null;
            /** @example nikon-fe */
            lens?: string | null;
            events?: string[] | null;
        };
        /** @description The details to change; a detail left out stays as it is. */
        UpdateFrameRequest: {
            /**
             * @description The new frame number, or null to clear it.
             * @example 12A
             */
            number?: string | null;
            title?: string | null;
            /** @description 1 to 5 stars, or null to clear the rating. */
            rating?: number | null;
            notes?: string | null;
            /**
             * @description The frame's own camera, or null to use its roll's again.
             * @example nikon-fe
             */
            camera?: string | null;
            /** @example nikon-fe */
            film?: string | null;
            /** @example nikon-fe */
            lens?: string | null;
            /** @description The frame's own events, or null to use its roll's again. */
            events?: string[] | null;
            /**
             * @description The version to show for the frame, one of its own, or null to show its newest.
             * @example 01M6EAAP694BKWR9HZ4N5Z54XD
             */
            defaultVersion?: string | null;
        };
        /** @description The details a frame ends up with, inherited from the archive and its roll (design section 6), each with where it came from. A detail set nowhere is left out. */
        FrameDetails: {
            author?: {
                value: string;
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
            copyright?: {
                value: string;
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
            camera?: {
                /** @example nikon-fe */
                value: string;
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
            film?: {
                /** @example nikon-fe */
                value: string;
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
            lens?: {
                /** @example nikon-fe */
                value: string;
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
            events?: {
                value: string[];
                source: {
                    /** @enum {string} */
                    layer: "archive" | "roll" | "frame";
                    id: string;
                };
            };
        };
        /** @description How the version is turned when shown; its file is never changed. */
        UpdateVersionRequest: {
            /** @description Degrees clockwise: 0, 90, 180 or 270. */
            rotate: 0 | 90 | 180 | 270;
        };
        CameraList: {
            cameras: components["schemas"]["Camera"][];
        };
        Camera: {
            /** @example nikon-fe */
            slug: string;
            /** @example Nikon */
            make: string;
            /** @example FE */
            model: string;
        };
        /** @description Its slug is made from its make and model. */
        CreateCameraRequest: {
            /** @example Nikon */
            make: string;
            /** @example FE */
            model: string;
        };
        FilmStockList: {
            films: components["schemas"]["FilmStock"][];
        };
        FilmStock: {
            /** @example nikon-fe */
            slug: string;
            /** @example Kodak */
            make: string;
            /** @example Portra 400 */
            name: string;
            /** @example 400 */
            iso: number | null;
            /**
             * @description What kind of picture the film gives.
             * @enum {string|null}
             */
            type: "black-and-white" | "colour-negative" | "colour-slide" | null;
            /**
             * @description The size of film.
             * @enum {string|null}
             */
            format: "110" | "120" | "127" | "220" | "35mm" | "4x5" | "8x10" | null;
        };
        /** @description Its slug is made from its make and name. */
        CreateFilmStockRequest: {
            /** @example Kodak */
            make: string;
            /** @example Portra 400 */
            name: string;
            iso?: number | null;
            /**
             * @description What kind of picture the film gives.
             * @enum {string|null}
             */
            type?: "black-and-white" | "colour-negative" | "colour-slide" | null;
            /**
             * @description The size of film.
             * @enum {string|null}
             */
            format?: "110" | "120" | "127" | "220" | "35mm" | "4x5" | "8x10" | null;
        };
        LensList: {
            lenses: components["schemas"]["Lens"][];
        };
        Lens: {
            /** @example nikon-fe */
            slug: string;
            /** @example Nikon */
            make: string;
            /** @example Nikkor AI-S */
            name: string;
            /**
             * @description In millimetres.
             * @example 50
             */
            focalLength: number | null;
            /**
             * @description The widest f-number.
             * @example 1.8
             */
            maxAperture: number | null;
        };
        /** @description Its slug is made from its make, name, focal length and aperture. */
        CreateLensRequest: {
            /** @example Nikon */
            make: string;
            /** @example Nikkor AI-S */
            name: string;
            focalLength?: number | null;
            maxAperture?: number | null;
        };
        EventList: {
            events: components["schemas"]["Event"][];
        };
        Event: {
            /** @example nikon-fe */
            slug: string;
            /** @example Iceland 2026 */
            name: string;
            /** @example 2026-09 */
            date: string | null;
        };
        CreateEventRequest: {
            /** @description What the event is called; its slug is made from it. */
            name: string;
            /** @example 2026-09 */
            date?: string | null;
        };
        /** @description The details to change. A detail left out stays as it is; a null date clears it. The slug never changes. */
        UpdateEventRequest: {
            name?: string;
            /** @example 2026-09 */
            date?: string | null;
        };
        Archive: {
            id: string;
            /**
             * @description Who took the photographs; frames inherit it.
             * @example Ben Pirt
             */
            author: string;
            /**
             * @description The copyright notice; frames inherit it.
             * @example © Ben Pirt. All rights reserved.
             */
            copyright: string | null;
        };
        /** @description Sets the archive up, once (D43). */
        CreateArchiveRequest: {
            author: string;
            copyright?: string;
        };
        /** @description The details to change. A detail left out stays as it is; null clears the copyright. The author can’t be cleared. */
        UpdateArchiveRequest: {
            author?: string;
            copyright?: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
