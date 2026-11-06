/*
we have this file configuring indexes for importing collections into Firestore
how to deploy it:
// copy firestore.indexes.json to the project root folder
> cd <project root folder>
> firebase login --reauth
> firebase deploy --only firestore:indexes
and
> firebase deploy --only firestore:rules

*/

/*
How importCollections works?
basically:
startImport:

reads all *.json in selected folder,
builds a map of what it found,
then imports only collections listed in its phase lists.

it scans that folder with sourceFolder.entries().
For every *.json file found in folder, it:
reads the file
strips .json from the filename
uses that as the collection name
So for example:

businesses.json → collection name businesses
contacts.json → collection name contacts

REMEMBER:
But not every JSON file is imported

WE have defined the import phases and the collections to be imported in useImportCollections.ts.
So if we add or remove a json or collection do update the IMPORT_PHASES constant accordingly in useImportCollections.ts file as well to ensure proper import order.

Actual importing is restricted by the hardcoded IMPORT_PHASES constant in libfsdb\libfsdb\hooks\useImportCollections.ts in libfsdb:

Phase 1: ap, reminder, prospect, tenantidmap, eqid, businesses
Phase 2: contacts, notes, tickets, activities, orders, subs
Phase 3: ticketnotes, downloads, carts, supporthoursused
*/

import { useState, useEffect, useRef } from 'react';
import { TextControl, FolderSelectControl } from '@n20a/libform';
import { getFirebaseServices } from '@n20a/libauth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { useImportCollections, type ISmdbProfile } from '@n20a/libfsdb';

type DirectoryEntries = AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;

const ImportCollections = () => {
    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};

    const [smdbProfile, setSmdbProfile] = useState<ISmdbProfile>({
        firebaseProject: cfg.FIREBASE_PROJECT_ID ?? '',
        fsdb: cfg.FIREBASE_FSDB ?? 'default',
        bucket: cfg.FIREBASE_BUCKET ?? '',
        sourceFolder: null,
    });
    const [jsonFileCount, setJsonFileCount] = useState(0);

    useEffect(() => {
        let isCancelled = false;

        const countJsonFiles = async () => {
            if (!smdbProfile.sourceFolder) {
                setJsonFileCount(0);
                return;
            }

            let count = 0;
            const sourceFolder = smdbProfile.sourceFolder as FileSystemDirectoryHandle & { entries(): DirectoryEntries };

            for await (const [name, handle] of sourceFolder.entries()) {
                if (handle.kind === 'file' && name.endsWith('.json')) {
                    count += 1;
                }
            }

            if (!isCancelled) {
                setJsonFileCount(count);
            }
        };

        void countJsonFiles();

        return () => {
            isCancelled = true;
        };
    }, [smdbProfile.sourceFolder]);

    // Follow the same auth-token lifecycle as ImportBusinesses.
    const { auth } = getFirebaseServices();
    const [firebaseToken, setFirebaseToken] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const token = user ? await user.getIdToken() : null;
            setFirebaseToken(token);
        });
        return unsubscribe;
    }, [auth]);

    const bottomPaneRef = useRef<HTMLDivElement>(null);

    const { state, startImport } = useImportCollections(auth, smdbProfile, firebaseToken);

    // autoscroll as log lines arrive
    useEffect(() => {
        if (bottomPaneRef.current) {
            bottomPaneRef.current.scrollTop = bottomPaneRef.current.scrollHeight;
        }
    }, [state.lines]);

    useEffect(() => {
        // console.log('Import state changed:', state);
    }, [smdbProfile.sourceFolder, jsonFileCount]);

    const isImporting = state.status === 'reading' || state.status === 'importing';
    const isImportEnabled =
        !isImporting &&
        !!smdbProfile.firebaseProject &&
        !!smdbProfile.fsdb &&
        smdbProfile.sourceFolder !== null &&
        !!firebaseToken;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--borderandscrollbar, #ccc)', flexShrink: 0 }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Import Collections to Firestore</h2>
                <TextControl
                    id="firebaseProject"
                    name="firebaseProject"
                    label="Firebase Project"
                    value={smdbProfile.firebaseProject}
                    readOnly
                />
                <TextControl
                    id="fsdb"
                    name="fsdb"
                    label="DB Name"
                    value={smdbProfile.fsdb}
                    readOnly
                />
                <TextControl
                    id="bucket"
                    name="bucket"
                    label="Bucket"
                    value={smdbProfile.bucket}
                    readOnly
                />

                <FolderSelectControl
                    id="sourceFolder"
                    name="sourceFolder"
                    label="Source Folder (containing JSON files)"
                    onChange={(value) => setSmdbProfile(prev => ({ ...prev, sourceFolder: value }))}
                />
                {smdbProfile.sourceFolder && smdbProfile.sourceFolder.name && (
                    <>
                        <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--text-secondary, #666)' }}>
                            {jsonFileCount === 0 && (
                                <span style={{ color: 'red' }}>No JSON files found in the selected folder.</span>
                            )}
                            {jsonFileCount > 0 && (
                                <span style={{ color: 'green' }}>
                                    {jsonFileCount} JSON file(s) found in the selected folder. Every *.json file in
                                    folder: "{smdbProfile.sourceFolder.name}" is selected to import into its
                                    respective collection; collection name is created by stripping ".json" from the
                                    filename; if collection name is found in approved collections list: IMPORT_PHASES 
                                    defined in libfsdb, json data is imported into collection else json file data is
                                    ignored.
                                </span>
                            )}
                        </p>
                        <hr />
                    </>
                )}
                <button
                    title="Import all collections from JSON files"
                    disabled={!isImportEnabled}
                    onClick={startImport}
                    style={{
                        marginTop: '16px',
                        padding: '10px 28px',
                        fontSize: '14px',
                        fontWeight: 600,
                        letterSpacing: '0.4px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: isImportEnabled ? 'pointer' : 'not-allowed',
                        backgroundColor: isImportEnabled ? 'var(--primary, #1a73e8)' : 'var(--borderandscrollbar, #ccc)',
                        color: '#fff',
                        transition: 'background-color 0.2s, opacity 0.2s',
                        opacity: isImportEnabled ? 1 : 0.6,
                        minWidth: '140px',
                    }}
                >
                    {isImporting 
                        ? `${state.currentPhase || 'Importing'}… (${state.processed}/${state.total})` 
                        : 'Start Import'}
                </button>
            </div>
            <div
                ref={bottomPaneRef}
                style={{ flex: 1, overflow: 'auto', padding: '16px' }}
            >
                {state.lines.map((line, i) => (
                    <div key={i} style={{ fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '2px' }}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Example: sign in with a static email/password and add one doc to the `eqid` collection.
 * Credentials are passed in (never hardcode the password in source); e.g. read them from
 * a git-ignored .env / APP_CONFIG, or prompt for them at runtime.
 */
export async function addDocToEqid(
    email: string,
    password: string,
    data: Record<string, unknown>,
): Promise<string> {
    const { app, auth } = getFirebaseServices();

    await signInWithEmailAndPassword(auth, email, password);

    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};
    const db = cfg.FIREBASE_FSDB && cfg.FIREBASE_FSDB !== 'default'
        ? getFirestore(app, cfg.FIREBASE_FSDB)
        : getFirestore(app);

    const ref = await addDoc(collection(db, 'eqid'), data);
    return ref.id;
}

// Usage:
// const id = await addDocToEqid('mgsy@netzoom.com', <password from secure source>, { name: 'test' });

export default ImportCollections;
export { ImportCollections };
