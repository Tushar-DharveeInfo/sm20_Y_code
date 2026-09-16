import type { IActivityDoc, CollectionName, ICollectionDocMap } from '../../allinterface/IDatasets';

interface IFnLogActivityParams {
    bid: string;
    cid?: string;
    message: string;
    createActivity?: (activity: Record<string, unknown>) => Promise<unknown>;
    createActivityLog?: (message: string) => Promise<void>;
    updateDataset?: <K extends CollectionName>(name: K, records: ICollectionDocMap[K][]) => void;
    currentActivities?: IActivityDoc[];
}

/**
 * Logs an activity event to Firestore (via useActivities and MainAppContext)
 * and updates the in-memory dataset in smDataContext.
 */
const FnLogActivity = async ({
    bid,
    cid = '',
    message,
    createActivity,
    createActivityLog,
    updateDataset,
    currentActivities,
}: IFnLogActivityParams): Promise<void> => {
    const now = new Date().toISOString();
    const effectiveCid = cid || 'User';
    const activityDoc: IActivityDoc = {
        bid,
        cid: effectiveCid,
        activityid: `activity_${effectiveCid}_${Date.now()}`,
        message,
        monitorupdated: now,
        monitor: false,
        datecreated: now,
    };

    // 1. Write to Firestore subcollection via useActivities createActivity hook
    if (createActivity) {
        try {
            await createActivity(activityDoc as unknown as Record<string, unknown>);
        } catch (err) {
            console.warn('FnLogActivity: createActivity hook failed (offline/mock mode):', err);
        }
    }

    // 2. Write to activity log via MainApp context
    if (createActivityLog) {
        try {
            await createActivityLog(message);
        } catch (err) {
            console.warn('FnLogActivity: createActivityLog failed:', err);
        }
    }

    // 3. Update smDataContext.datasets.activities in-memory
    if (updateDataset && currentActivities) {
        try {
            updateDataset('activities', [
                activityDoc,
                ...currentActivities,
            ]);
        } catch (err) {
            console.warn('FnLogActivity: updateDataset failed:', err);
        }
    }
};

export { FnLogActivity };
export type { IFnLogActivityParams };
