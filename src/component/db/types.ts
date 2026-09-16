export type {
  IFirestoreQueryFilter,
  IFirestoreOrderBy,
  IFirestoreBatchOperation,
  ICreateDocumentRequest,
  IUpdateDocumentRequest,
  IUpsertDocumentRequest,
  IDeleteDocumentRequest,
  IGetDocumentRequest,
  IQueryDocumentsRequest,
  IQueryGroupRequest,
  IBatchWriteRequest,
  IFirestoreWriteResult,
  IFirestoreReadResult,
  IFirestoreQueryResult,
  IFirestoreApiEnvelope,
} from '@n20a/libfsdb';

export type { ISmdbProfile, ImportState } from '@n20a/libfsdb';

export type {
  IBusinessDoc,
  IContactDoc,
  INoteDoc,
  ITicketDoc,
  ITicketNoteDoc,
  IActivityDoc,
  IOrderDoc,
  ICartDoc,
  ISupportHoursUsedDoc,
  ISubDoc,
  IVssDownloadDoc,
  ITodoDoc,
  IProspectDoc,
  ICollectionDocMap,
} from '@n20a/libfsdb';

export {
  // Root collection hooks
  useBusinesses,
  useTodos,
  useProspects,

  // Business-scoped subcollection hooks
  useContacts,
  useBusinessNotes,
  useBusinessTickets,
  useActivities,
  useOrders,
  useSubs,

  // Business-scoped nested collection hooks
  useTicketNotes,
  useOrderCarts,
  useOrderSupportHoursUsed,
  useSubDownloads,
} from '@n20a/libfsdb';

export { useImportCollections} from '@n20a/libfsdb';

export {
  // Generic state management hooks
  useFirestoreOperation,
  useCloudStorageOperation,

  // File operation hooks
  useFileUpload,
  useFileDownload,
  useFileList,
  useFileMetadata,
  useFileDelete,

  // Composite hooks
  useAutoLoad,
} from '@n20a/libfsdb';
