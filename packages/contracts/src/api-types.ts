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
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Set or clear many frames' numbers in one save
         * @description As when renumbering a roll. Frames not listed are left alone. Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.
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
                    "application/json": components["schemas"]["UpdateFrameNumbersRequest"];
                };
            };
            responses: {
                /** @description The roll, with its new numbers. */
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
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Set or clear a frame's number
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
            description: string | null;
            /** @example 2026-09-14 */
            shot: string | null;
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
            description?: string;
            /** @example 2026-09-14 */
            shot?: string;
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
        UpdateFrameRequest: {
            /**
             * @description The new frame number, or null to clear it.
             * @example 12A
             */
            number: string | null;
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
