const mongoose = require('mongoose');

// Records a real "view" event whenever a user opens a document from the
// Search Results page or the History panel. Powers the History panel's
// "Views" filter tab — this is genuinely tracked activity, not synthesized.
const ViewLogSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: String,
            required: true,
            index: true
        },
        queryId: {
            type: String,
            default: null,
            index: true
        },
        queryText: {
            type: String,
            default: ''
        },
        documentId: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'Untitled'
        },
        userId: {
            type: String,
            default: null
        },
        username: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

ViewLogSchema.index({ workspaceId: 1, createdAt: 1 });

module.exports = mongoose.model('ViewLog', ViewLogSchema);
