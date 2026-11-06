
import { useState, useEffect, useRef } from 'react';
import { TextControl, FileSelectControl } from '@n20a/libform';
import { getFirebaseServices } from '@n20a/libauth';
import { useImportClientCollectionsFromXlsx, type ISmdbXlsxProfile } from '@n20a/libfsdb'; 

const NewClients = () => {
    const cfg = (window as Window & { APP_CONFIG?: Record<string, string> }).APP_CONFIG ?? {};

    const [smdbXlsxProfile, setSmdbXlsxProfile] = useState<ISmdbXlsxProfile>({
        firebaseProject: cfg.FIREBASE_PROJECT_ID ?? '',
        fsdb: cfg.FIREBASE_FSDB ?? 'default',                       // Default Firestore DB name if not specified in config
        bucket: cfg.FIREBASE_BUCKET ?? '',
        sourceXlsxFile: null,
    });

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

    const { state, startImport, validate, reset } = useImportClientCollectionsFromXlsx(auth, smdbXlsxProfile, firebaseToken);
    const hasValidXlsxFile = smdbXlsxProfile.sourceXlsxFile?.name.endsWith('.xlsx') ?? false;

    // autoscroll as log lines arrive
    useEffect(() => {
        if (bottomPaneRef.current) {
            bottomPaneRef.current.scrollTop = bottomPaneRef.current.scrollHeight;
        }
    }, [state.lines]);

    const isValidating = state.status === 'validating';
    const isImporting = state.status === 'reading' || state.status === 'importing';
    const isBusy = isImporting || isValidating;
    const isValidateEnabled = !isBusy && hasValidXlsxFile;
    const isImportEnabled =
        !isBusy &&
        !!smdbXlsxProfile.firebaseProject &&
        !!smdbXlsxProfile.fsdb &&
        hasValidXlsxFile &&
        !!firebaseToken;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--borderandscrollbar, #ccc)', flexShrink: 0 }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Import New Clients and Users from Excel</h2>
                <TextControl
                    id="firebaseProject"
                    name="firebaseProject"
                    label="Firebase Project"
                    value={smdbXlsxProfile.firebaseProject}
                    readOnly
                />
                <TextControl
                    id="fsdb"
                    name="fsdb"
                    label="DB Name"
                    value={smdbXlsxProfile.fsdb}
                    readOnly
                />
                <TextControl
                    id="bucket"
                    name="bucket"
                    label="Bucket"
                    value={smdbXlsxProfile.bucket}
                    readOnly
                />

                <FileSelectControl
                    id="sourceXlsxFile"
                    name="sourceXlsxFile"
                    label="Source XLSX File"
                    accept=".xlsx"
                    onChange={(value) => {
                        reset();
                        setSmdbXlsxProfile(prev => ({ ...prev, sourceXlsxFile: value[0] ?? null }));
                    }}
                />
                {smdbXlsxProfile.sourceXlsxFile && smdbXlsxProfile.sourceXlsxFile.name && (
                    <>
                        <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--text-secondary, #666)' }}>
                            {!hasValidXlsxFile && (
                                <span style={{ color: 'red' }}>Selected file is not a valid .xlsx workbook.</span>
                            )}
                            {hasValidXlsxFile && (
                                <span style={{ color: 'green' }}>
                                    Workbook "{smdbXlsxProfile.sourceXlsxFile.name}" is selected. The workbook must
                                    contain a single worksheet named "newclients". Tenants and users are created (or
                                    skipped if they already exist), and a "tenantassigned" workbook with the tenant id
                                    in the bid column is produced for download.
                                </span>
                            )}
                        </p>
                        <hr />
                    </>
                )}
                <button
                    title="Validate worksheet records against the required columns and datatypes"
                    disabled={!isValidateEnabled}
                    onClick={validate}
                    style={{
                        marginTop: '16px',
                        marginRight: '12px',
                        padding: '10px 28px',
                        fontSize: '14px',
                        fontWeight: 600,
                        letterSpacing: '0.4px',
                        borderRadius: '6px',
                        border: '1px solid var(--primary, #1a73e8)',
                        cursor: isValidateEnabled ? 'pointer' : 'not-allowed',
                        backgroundColor: 'transparent',
                        color: isValidateEnabled ? 'var(--primary, #1a73e8)' : 'var(--text-secondary, #666)',
                        transition: 'background-color 0.2s, opacity 0.2s',
                        opacity: isValidateEnabled ? 1 : 0.6,
                        minWidth: '140px',
                    }}
                >
                    {isValidating
                        ? `${state.currentPhase || 'Validating'}… (${state.processed}/${state.total})`
                        : 'Validate'}
                </button>
                <button
                    title="Import all collections from XLSX worksheets"
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
                {state.result && (
                    <button
                        style={{ marginTop: '16px', marginLeft: '12px', padding: '10px 28px', fontSize: '14px', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary, #1a73e8)', color: '#fff' }}
                        onClick={() => {
                            const url = URL.createObjectURL(state.result!.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = state.result!.fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                    >
                        Download {state.result.fileName}
                    </button>
                )}
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

export default NewClients;
export { NewClients };
