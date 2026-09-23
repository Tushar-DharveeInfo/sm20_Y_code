import { useState, useEffect } from "react";
import { useFileDownload } from "@n20a/libfsdb";

//  filePath = `n20-bucket-01/${folderName}/envservice.json`
const LoadJson = (filePath: string) => 
{
    const [JsonFile, setJsonFile] = useState<Record<string, any>>();
    const { downloadSingleFile } = useFileDownload();

    useEffect(() => {
        if (!filePath) return;

        let cancelled = false;
        let objectUrl: string | undefined;

        const loadJsonFile = async () => {
            const result = await downloadSingleFile(filePath);
            if (!result.success || !result.blobUrl) return;
            objectUrl = result.blobUrl;

            try {
                const response = await fetch(result.blobUrl);
                const json = await response.json();
                if (!cancelled) setJsonFile(json);
            } catch (parseError) {
                console.error("Error parsing JsonFileservice.json:", parseError);
            }
        };

        loadJsonFile();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filePath, downloadSingleFile]);

    return { JsonFile };
};

export default LoadJson;
export { LoadJson };
