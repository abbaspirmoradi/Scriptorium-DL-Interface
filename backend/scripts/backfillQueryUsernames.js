/**
 * One-off backfill: set Query.username from Query.userId's referenced User,
 * for rows created before query creation started storing username directly
 * (see workspaceController.js createQuery / createWorkspace).
 *
 * Safe to re-run: only touches rows where username is missing, and only
 * writes a value when the referenced user actually still exists.
 *
 * Usage (from backend/):
 *   node scripts/backfillQueryUsernames.js
 *   node scripts/backfillQueryUsernames.js --dry-run   # report only, no writes
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Query = require('../models/queryModel');
const User = require('../models/userModel');

const isDryRun = process.argv.includes('--dry-run');

async function run() {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI is not set (expected in backend/.env). Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('Connected to MongoDB.');

    const staleQueries = await Query.find({
        userId: { $ne: null },
        $or: [{ username: null }, { username: { $exists: false } }]
    });

    console.log(`Found ${staleQueries.length} query row(s) with a userId but no username.`);

    let updated = 0;
    let skippedNoUser = 0;

    for (const query of staleQueries) {
        const user = await User.findById(query.userId).select('username');

        if (!user || !user.username) {
            skippedNoUser += 1;
            continue;
        }

        if (isDryRun) {
            console.log(`[dry-run] would set query ${query._id} username -> "${user.username}"`);
            updated += 1;
            continue;
        }

        query.username = user.username;
        await query.save();
        updated += 1;
    }

    console.log('---');
    console.log(`${isDryRun ? 'Would update' : 'Updated'}: ${updated}`);
    console.log(`Skipped (userId no longer resolves to a user): ${skippedNoUser}`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
