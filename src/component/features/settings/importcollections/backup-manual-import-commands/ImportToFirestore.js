/*
it requires:
Make sure you have installed the Admin SDK using npm install firebase-admin

enhance code to pass authtoken for authenticated requests
run the following command to execute the import script:

> node importToFirestore.js


Note:
Yes, this script will work perfectly even if you have 2,000, 20,000, or more documents in each collection. It was specifically engineered to scale past Firestore's strict transactional constraints by utilizing an automated array chunking strategy.

While Promise.all() is fast, executing thousands of network batches simultaneously can overwhelm your system memory or hit Google's network rate limits if your collection sizes expand to tens of thousands of items.If you plan to scale the generator past 5,000–10,000 documents per file, modify the importCollection function inside the script to use controlled concurrency instead of a wide-open Promise.all().
*/

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Initialize Firebase Admin SDK
// Make sure GOOGLE_APPLICATION_CREDENTIALS environment variable is set,
// or pass your service account file directly to cert()
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// 2. Set the Source Directory matching your mock generator
const SOURCE_DIR = path.join(__dirname, 'samplecollections');

const MAX_BATCH_SIZE = 400; // Safe threshold under Firestore's 500 limit

/**
 * Splits an array of operations into optimized smaller batch chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Reads a JSON file safely from the target subdirectory
 */
function readJsonFile(collectionName) {
  const filePath = path.join(SOURCE_DIR, `${collectionName}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ File not found: ${filePath}. Skipping...`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Converts ISO String dates into true native Firestore Timestamps
 */
function parseTimestamps(data) {
  const processed = { ...data };
  Object.keys(processed).forEach((key) => {
    // If field name indicates a timestamp type and contains a valid ISO string format
    if ((key.endsWith('created') || key.endsWith('updated') || key.endsWith('date') || key.endsWith('released') || key.endsWith('requested') || key.endsWith('used')) && typeof processed[key] === 'string') {
      processed[key] = admin.firestore.Timestamp.fromDate(new Date(processed[key]));
    }
  });
  return processed;
}

/**
 * Resolves the hierarchical database path based on structural keys inside the document
 */
function getTargetDocRef(collectionName, item) {
  switch (collectionName) {
    case 'businesses':
      return db.collection('businesses').doc(item.bid);
    case 'contacts':
      return db.collection('businesses').doc(item.bid).collection('contacts').doc(item.cid);
    case 'notes':
      return db.collection('businesses').doc(item.bid).collection('notes').doc(item.noteid);
    case 'tickets':
      return db.collection('businesses').doc(item.bid).collection('tickets').doc(item.ticketid);
    case 'ticketnotes':
      // Deep Subcollection hierarchy: /businesses/{bid}/tickets/{ticketid}/ticketnotes/
      return db.collection('businesses').doc(item.bid)
               .collection('tickets').doc(item.ticketid)
               .collection('ticketnotes').doc(); // Auto-generates ID for deep notes
    case 'activities':
      return db.collection('businesses').doc(item.bid).collection('activities').doc(item.activityid);
    case 'orders':
      return db.collection('businesses').doc(item.bid).collection('orders').doc(item.orderid);
    case 'carts':
      // Deep Subcollection hierarchy: /businesses/{bid}/orders/{orderid}/carts/
      return db.collection('businesses').doc(item.bid)
               .collection('orders').doc(item.orderid)
               .collection('carts').doc(); // Auto-generates ID for deep cart records
    case 'supporthoursused':
      // Deep Subcollection hierarchy: /businesses/{bid}/orders/{orderid}/supporthoursused/
      return db.collection('businesses').doc(item.bid)
               .collection('orders').doc(item.orderid)
               .collection('supporthoursused').doc(); // Auto-generates ID for deep support-hours records
    case 'subs':
      return db.collection('businesses').doc(item.bid).collection('subs').doc(item.subsid);

    case 'downloads':
      // Deep Subcollection hierarchy: /businesses/{bid}/subs/{subsid}/downloads/
      return db.collection('businesses').doc(item.bid)
               .collection('subs').doc(item.subsid)
               .collection('downloads').doc(); // Auto-generates ID for deep download records
    case 'reminder':
      return db.collection('reminder').doc(); // Independent root collection
    case 'prospect':
      return db.collection('prospect').doc(item.cid); // Independent root collection keyed by unique cid
    default:
      throw new Error(`Unknown collection structure target: ${collectionName}`);
  }
}

/**
 * Processes a collection array into batches and commits them to the live database in parallel
 */
/**
 * Processes a collection array into batches and commits them to the live database.
 * Optimized for large datasets (2,000+ docs) to keep network traffic and memory stable.
 */
async function importCollection(collectionName) {
  const records = readJsonFile(collectionName);
  if (!records || records.length === 0) return;

  console.log(`\n📦 Processing target upload stream for: [${collectionName}] (${records.length} records)`);

  // Map raw data arrays to Firestore references
  const operations = records.map(item => ({
    ref: getTargetDocRef(collectionName, item),
    data: parseTimestamps(item)
  }));

  // 🧩 KEEPING CHUNK ARRAY: We still call your chunkArray function here!
  const operationalChunks = chunkArray(operations, MAX_BATCH_SIZE);

  // 🔥 REPLACEMENT HERE: We loop through chunks one-by-one instead of using Promise.all()
  for (let i = 0; i < operationalChunks.length; i++) {
    const chunk = operationalChunks[i];
    const batch = db.batch();
    
    chunk.forEach(op => {
      batch.set(op.ref, op.data, { merge: true });
    });

    // We wait for this batch to finish uploading before moving to the next chunk
    await batch.commit();
    console.log(`   ⚡ Batch execution #${i + 1}/${operationalChunks.length} finalized successfully (${chunk.length} items).`);
  }

  console.log(`✅ Complete pipeline upload finalized for collection: [${collectionName}]`);
}

/**
 * Execution Orchestrator
 * The for loop uploads Chunk 1, waits, uploads Chunk 2, waits, and continues sequentially. This ensures Google doesn't flag your script for hitting them with too many parallel network requests at once.
 */
async function startPipeline() {
  console.log('🚀 Launching Optimized Parallel Firestore Data Import Pipeline...');
  const startTime = Date.now();

  try {
    // Phase 1: Independent and Main Root Collections
    await importCollection('businesses');
    await importCollection('reminder');
    await importCollection('prospect');

    // Phase 2: First-Level Subcollections
    await importCollection('contacts');
    await importCollection('notes');
    await importCollection('tickets');
    await importCollection('activities');
    await importCollection('orders');
    await importCollection('subs');

    // Phase 3: Deep Nested Subcollections
    await importCollection('ticketnotes');
    await importCollection('downloads');
    await importCollection('carts');
    await importCollection('supporthoursused');

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [PIPELINE SUCCESS] All records completely synchronized to Firestore in ${totalTime}s!`);

  } catch (error) {
    console.error('\n❌ [PIPELINE CRITICAL FAILURE] Execution aborted due to error:', error);
  }
}

startPipeline();
