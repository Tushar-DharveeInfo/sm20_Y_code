import { useFileDownload } from "@n20a/libfsdb";

type DownloadSingleFile = ReturnType<typeof useFileDownload>["downloadSingleFile"];

const LoadJson = async (filePath: string, downloadSingleFile: DownloadSingleFile): Promise<unknown | undefined> => {
    if (!filePath) return undefined;

    const result = await downloadSingleFile(filePath);
    if (!result.success || !result.blobUrl) return undefined;

    try {
        const response = await fetch(result.blobUrl);
        return await response.json();
    } finally {
        URL.revokeObjectURL(result.blobUrl);
    }
};

export default LoadJson;
export { LoadJson };
