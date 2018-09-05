
/**
 * A persisted save of a video drawover.
 * 
 * Storable in localStorage, uploadable to a webserver (..if future requirements demand),
 * exportable to the user's disk, importable from the user's disk. 
 *
 * A save file is associated with a video source - based on the metadata
 * of the source File object. If an exact match cannot be made - it determines
 * at what confidence it's a match and the end user can decide whether they 
 * should import the save.
 */
class SaveFile
{
    /**
     * Persist this save file to localStorage
     *
     * Will update modified date, and set creation date
     * if this is the first time the file has been saved
     */
    save() {

    }

    /**
     * Check if saving is possible currently
     *
     * May return false if the browser does not support
     * localStorage and we have no other backup solution.
     * In which case, `export/import` have to be used if
     * the user wants to save a copy of their work. 
     *
     * @return {boolean}
     */
    canSave() {

    }

    /**
     * Persist a frame drawover to this save file
     *
     * If a frame already exists with the same number, it 
     * will be replaced.
     *
     * @param {Number} frame number to add
     * @param {string} serialized history stack of the Draw component
     */
    addFrame(frame, serialized) {

    }

    /**
     * Delete a frame drawover from this save file
     *
     * @param {Number} frame number to remove
     */
    removeFrame(frame) {

    }

    /**
     * Generate a downloadable {FORMAT} from this save file
     *
     * @return {FORMAT}
     */
    export() {
        // TODO: Format? Blob, XML? JSON?
    }

    /**
     * Import data from {FORMAT} into this save file
     *
     * Used when the user uploads data from their hard drive to 
     * accompany a source video upload, rather than using localStorage
     * 
     * @param {FORMAT} FORMAT
     */
    import(FORMAT) {

    }

    /**
     * Set metadata for the source video from the user's hard drive
     *
     * We maintain this information to provide the ability to reload
     * a save automatically when a matching file is uploaded.
     * 
     * @param {string} name Source filename
     * @param {Number} size in bytes
     * @param {string} type Mime type
     * @param {Number} lastModified UNIX timestamp
     * @param {Number} fps Video framerate
     */
    setSource(name, size, type, lastModified, fps) {

    }

    /**
     * Determine if this save matches the input source
     *
     * If it doesn't match exactly with the source File data,
     * this will return a list of human-readable errors as to
     * why there's a mismatch (incorrect filesize, changed 
     * filename, lastModified has been updated, framerate
     * doesn't match, etc)
     *
     * @param {string} name Source filename
     * @param {Number} size in bytes
     * @param {string} type Mime type
     * @param {Number} lastModified UNIX timestamp
     * @param {Number} fps Video framerate
     *
     * @return {array}
     */
    validateSource(name, size, type, lastModified, fps) {

    }

    /**
     * Set the state of the application workspace
     *
     * Persists playback ranges, current frame, tools, layout, etc 
     * so that when the save file is reloaded, the user can return 
     * to where they left off for the particular source video
     *
     * @param {Number} startFrame
     * @param {Number} endFrame
     * @param {Number} currentFrame
     * @param {Number} playbackSpeed
     */
    setAppState(startFrame, endFrame, currentFrame, playbackSpeed) {
        // TODO: Tool settings? There's not a lot there so 
        // probably shouldn't even bother
    }

    // Should we do the above, or:

    set startFrame(val) {
        ... persist
        this.hasUnsavedChanges = true;
    }

    get startFrame() {

    }
}
