import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import './DownloadShapes.css';

// Use runtime config for API URL
const getApiBase = () => {
  const cloudRunUrl = (window as any).APP_CONFIG?.CLOUDRUN_URL || 'https://n20-storage-cloudrun-mkvwooi2sa-uc.a.run.app';
  return `${cloudRunUrl}/api`;
};
const API_BASE = getApiBase();
                  
// Type for API file response
interface ApiFileItem {
  name: string;
  updated: string;
  size: number;
}

interface FileItem {
  name: string;
  fullPath?: string; // Full path relative to baseFolder (for delete operations)
  updated: string;
  size?: number;
}

// Helper function to map API files to FileItem format
const mapApiFilesToFileItems = (apiFiles: ApiFileItem[]): FileItem[] => {
  return apiFiles.map((f: ApiFileItem) => {
    // Store full path from API (relative to baseFolder)
    const fullPath = f.name || '';
    // Extract just the filename for display (remove folder path if present)
    const fileName = fullPath && fullPath.includes('/') ? fullPath.substring(fullPath.lastIndexOf('/') + 1) : fullPath;
    return {
      name: fileName,
      fullPath: fullPath, // Keep full path for delete operations
      updated: f.updated || '',
      size: typeof f.size === 'number' ? f.size : 0
    };
  });
};

// Export utility functions
const exportToCSV = (data: FileItem[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = ['Filename', 'Date', 'Size'];
  const csvContent = [
    headers.join(','),
    ...data.map(item => [
      `"${item.name}"`,
      `"${item.updated}"`,
      `"${item.size ? formatFileSize(item.size) : 'N/A'}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const exportToExcel = (data: FileItem[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Create a simple Excel-compatible format (TSV)
  const headers = ['Filename', 'Date', 'Size'];
  const tsvContent = [
    headers.join('\t'),
    ...data.map(item => [
      item.name,
      item.updated,
      item.size ? formatFileSize(item.size) : 'N/A'
    ].join('\t'))
  ].join('\n');

  const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
// VisioStencilsBucket
export default function VisioStencilsBucket() {
  console.log('VisioStencilsBucket component mounting/rendering');

  const [writePermitted, setWritePermitted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState('');
  const [bucket, setBucket] = useState('');
  const [libFolder, setLibFolder] = useState('');
  const [rootFolders, setRootFolders] = useState<string[]>([]);
  const [selectedRootFolder, setSelectedRootFolder] = useState('/');
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [checkedFiles, setCheckedFiles] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof FileItem; direction: 'asc' | 'desc' } | null>(null);
  const [popupFile, setPopupFile] = useState<string | null>(null);
  const [popupContent, setPopupContent] = useState<string>('');
  const [popupError, setPopupError] = useState<string>('');
  const [popupLoading, setPopupLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [validationCode] = useState('test123');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [uploadData, setUploadData] = useState<{files: FileList | null; isFolder: boolean; sourcePath: string; targetPath: string; displayPath: string} | null>(null);
  
  // Timing tracking states
  const [fileListTime, setFileListTime] = useState<number | null>(null);
  
  // Trigger to force refresh file list
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // LoadFilecontent for Dblclick (dbl or ctrl)
  const handleFilenameClick = (file: FileItem, event: React.MouseEvent<HTMLTableCellElement>) => {
    if (event.detail === 2 || event.ctrlKey) {
      setError(''); // Clear any previous success/error messages
      console.log('🔍 Loading file content for:', file.name);
      console.log('📂 From folder:', selectedFolder);
      console.log('🏗️ ProjectId:', projectId, 'Bucket:', bucket);
      setPopupFile(file.name);
      setPopupContent('');
      setPopupError('');
      setPopupLoading(true);
      // Add timeout for fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        setPopupContent('');
        setPopupError('Request timed out');
        setPopupLoading(false);
      }, 30000); // 30 seconds
      //loadFilecontent click (dbl or ctrl)
      // Extract just the filename (remove folder path if present)
      const fileName = file.name.includes('/') ? file.name.substring(file.name.lastIndexOf('/') + 1) : file.name;
      console.log('🔧 Extracted filename from:', file.name, 'to:', fileName);
      
      const folderPath = constructFolderPath(selectedRootFolder, selectedFolder);
      const fullFilePath = folderPath ? 
        (folderPath.endsWith('/') ? folderPath + fileName : folderPath + '/' + fileName) : 
        fileName;
      const requestBody = { 
        validationCode: validationCode || 'default-code',
        bucketName: bucket,
        baseFolder: libFolder,
        filePath: fullFilePath
      };
      console.log('📤 Sending file metadata request with body:', JSON.stringify(requestBody, null, 2));
      
      fetch(`${API_BASE}/files/metadata`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                  signal: controller.signal
                })
        .then(async res => {
          clearTimeout(timeoutId);
          console.log('🔍 File content API response status:', res.status, res.statusText);
          
          // Check if the response is successful
          if (!res.ok) {
            const errorText = await res.text();
            console.error('❌ API returned error status:', res.status);
            console.error('❌ Error response:', errorText);
            
            // Try to parse error message
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.error) {
                setPopupError(`API Error: ${errorData.error}`);
              } else {
                setPopupError(`HTTP ${res.status}: ${res.statusText}`);
              }
            } catch {
              setPopupError(`HTTP ${res.status}: ${res.statusText}`);
            }
            setPopupLoading(false);
            return;
          }
          
          const text = await res.text();
          console.log('🔍 File content API raw response:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
          console.log('📊 Response length:', text.length);
          console.log('📋 Response type:', typeof text);
          
          let data;
          try {
            data = JSON.parse(text);
            console.log('✅ Successfully parsed JSON response');
            console.log('📝 Parsed data type:', typeof data);
            console.log('📝 Parsed data keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
            console.log('📝 Parsed data sample:', JSON.stringify(data).substring(0, 200) + '...');
          } catch (parseError) {
            console.log('⚠️ Failed to parse as JSON, treating as plain text');
            console.log('❌ Parse error:', parseError);
            // Not JSON, treat as plain text
            if (text.trim() === '') {
              setPopupContent('');
              setPopupError('File is empty');
            } else {
              setPopupContent(text);
              setPopupError('');
            }
            setPopupLoading(false);
            return;
          }
          
          // Handle different response formats from file-content endpoint
          if (data && typeof data.content === 'string') {
            console.log('✅ Found data.content (string):', data.content.length, 'characters');
            if (data.content.trim() === '') {
              setPopupContent('');
              setPopupError('File is empty');
            } else {
              try {
                const json = JSON.parse(data.content);
                console.log('✅ Successfully parsed nested JSON content');
                setPopupContent(JSON.stringify(json, null, 2));
                setPopupError('');
              } catch {
                console.log('⚠️ Content is not JSON, showing as plain text');
                setPopupContent(data.content);
                setPopupError('');
              }
            }
          } else if (typeof data === 'string') {
            console.log('✅ Data is direct string:', data.length, 'characters');
            if (data.trim() === '') {
              setPopupContent('');
              setPopupError('File is empty');
            } else {
              try {
                const json = JSON.parse(data);
                console.log('✅ Successfully parsed direct string as JSON');
                setPopupContent(JSON.stringify(json, null, 2));
                setPopupError('');
              } catch {
                console.log('⚠️ Direct string is not JSON, showing as plain text');
                setPopupContent(data);
                setPopupError('');
              }
            }
          } else if (Array.isArray(data)) {
            console.log('✅ Data is an array with', data.length, 'items');
            // API returned an array of objects (which is the case here)
            setPopupContent(JSON.stringify(data, null, 2));
            setPopupError('');
          } else if (data && typeof data === 'object') {
            console.log('✅ Data is an object, displaying as JSON');
            // API returned a single object
            setPopupContent(JSON.stringify(data, null, 2));
            setPopupError('');
          } else {
            console.error('❌ Unexpected response format!');
            console.error('❌ Data type:', typeof data);
            console.error('❌ Data value:', data);
            console.error('❌ Data is null:', data === null);
            console.error('❌ Data is undefined:', data === undefined);
            console.error('❌ Data has content property:', data && typeof data === 'object' && 'content' in data);
            console.error('❌ Full data object:', JSON.stringify(data, null, 2));
            setPopupContent('');
            setPopupError(`File content not found or invalid format. Got ${typeof data}: ${JSON.stringify(data)}`);
          }
          setPopupLoading(false);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            setPopupContent('');
            setPopupError('Request timed out');
          } else {
            setPopupContent('');
            setPopupError('Failed to fetch file content');
          }
          setPopupLoading(false);
        });
    }
  };

  const handleClosePopup = () => {
    setPopupFile(null);
    setPopupContent('');
    setPopupError('');
    setPopupLoading(false);
  };

  // Initialize with hardcoded configuration values to match DeviceLibraryBucket.tsx
  useEffect(() => {
    console.log('🔄 Initializing configuration values');
    
    // Use VSS-specific project and bucket configuration with vssfolder-01
    const projectId = "n20-fb-01";
    const bucket = "n20-bucket-01";
    const libFolder = "vssfolder-01";
    
    console.log('🔧 Setting projectId:', projectId, 'bucket:', bucket, 'libFolder:', libFolder);
    setProjectId(projectId);
    setBucket(bucket);
    setLibFolder(libFolder);
    setError(''); // Clear any previous errors
  }, []);

  // Load root folders from VSSFolder using CloudRun API
  useEffect(() => {
    if (!projectId || !bucket || !libFolder || !validationCode) {
      console.log('⚠️ Missing required values, skipping root folders load');
      console.log('⚠️ Values check:', { projectId, bucket, libFolder, validationCode });
      return;
    }

    console.log('🔄 Loading root folders from VSSFolder:', libFolder);
    console.log('🔧 API Configuration:', {
      url: `${API_BASE}/gcs/folders-fast`,
      validationCode: validationCode,
      baseFolder: libFolder,
      bucket: bucket,
      projectId: projectId
    });
    console.log('🔍 Bucket state variable type:', typeof bucket, 'value:', bucket);
    setLoading(true);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('⏰ Root folders API request timed out');
    }, 30000); // 30 seconds

    const requestBody = {
      validationCode: validationCode,
      bucketName: bucket, // Use the bucket state variable
      baseFolder: libFolder, // 'vssfolder-01' - the base bucket folder
      folder: '', // Empty string to get root level subfolders within baseFolder
      limit: 10000 // Request up to 10,000 root folders to avoid pagination
    };
    
    console.log('🔍 Requesting root folders under baseFolder:', libFolder);
    console.log('📂 API will normalize empty folder to "root" and list subfolders of baseFolder');
    console.log('📂 Expected: Should return the 6 folders under vssfolder-01');
    console.log('🔍 Bucket in requestBody - type:', typeof requestBody.bucketName, 'value:', requestBody.bucketName);
    console.log('📤 Sending request body:', JSON.stringify(requestBody, null, 2));

    fetch(`${API_BASE}/gcs/folders-fast`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    .then(async res => {
      clearTimeout(timeoutId);
      console.log('✅ Root folders API response:', res.status, res.statusText);
      console.log('📍 Response URL:', res.url);
      console.log('📊 Response headers:', res.headers.get('content-type'));
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('📁 Root folders data received:', data);
      console.log('📁 Data type:', typeof data);
      console.log('📁 Data keys:', Object.keys(data || {}));
      console.log('📁 Complete API response:', JSON.stringify(data, null, 2));
      
      // Extract folders from response
      const foldersArray = data.folders || [];
      console.log('📋 Folders array:', foldersArray);
      console.log('📋 Folders array length:', foldersArray.length);
      console.log('📋 Raw folders array:', foldersArray);
      console.log('📋 Each folder in array:');
      foldersArray.forEach((folder: any, index: number) => {
        console.log(`📁 [${index}]:`, typeof folder, '"' + folder + '"');
      });
      
      // Format folders with '/' prefix and sort case-insensitive
      const formattedFolders = foldersArray
        .map((folder: string) => '/' + folder.replace(/^\/+/, '')) // Add '/' prefix, remove any existing leading slashes
        .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort
      
      // Add '/' as first item (no subfolder)
      const finalFolders = ['/', ...formattedFolders];
      
      console.log('✅ Formatted root folders:', finalFolders);
      setRootFolders(finalFolders);
      
      // Set first item as default selection
      if (finalFolders.length > 0) {
        setSelectedRootFolder(finalFolders[0]);
        console.log('🔧 Auto-selected first root folder:', finalFolders[0]);
      }
      
      // setSearchJsonLoadComplete(true); // Removed - variable deleted
      setLoading(false);
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.error('❌ Failed to load root folders:', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      
      if (err.name === 'AbortError') {
        setError('⚠️ Root folders load timeout: Server not responding');
      } else if (err.message.includes('401')) {
        setError('⚠️ Authentication failed: Invalid validation code');
      } else if (err.message.includes('404')) {
        setError('⚠️ API endpoint not found or bucket/folder does not exist');
      } else if (err.message.includes('403')) {
        setError('⚠️ Permission denied: Check bucket access permissions');
      } else if (err.message.includes('Failed to fetch')) {
        setError('⚠️ Network error: Cannot reach CloudRun service');
      } else {
        setError(`⚠️ Failed to load root folders: ${err.message}`);
      }
      
      // Set fallback with just the '/' option
      setRootFolders(['/']);
      setSelectedRootFolder('/');
      // setSearchJsonLoadComplete(false); // Removed - variable deleted
      setLoading(false);
    });
  }, [projectId, bucket, libFolder, validationCode]);

  // LoadFolders on mount by reading search.json (runs AFTER env variables are loaded)
  // NOTE: Commented out - now using CloudRun /gcs/folders-fast API instead
  /*
  useEffect(() => {
    if (!projectId || !bucket) {
      console.log('⚠️ Missing projectId or bucket, skipping search.json load');
      return;
    }
    
    // Only run once - use ref to prevent multiple API calls
    if (searchJsonLoaded.current) {
      console.log('⚠️ search.json already loaded, skipping duplicate load');
      return;
    }
    
    searchJsonLoaded.current = true;
    console.log('Loading MfgAcronym folders from search.json on mount');
    setLoading(true);
    setError('');
    
    // Start timing for search.json load
    const searchJsonStartTime = Date.now();
    
    // Add timeout for fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('⏰ search.json fetch request timed out');
    }, 30000); // 30 seconds
    
    //load search.json on mount, because it has all mfgacronym and mfg names
    // Specify the folder where search.json is located (adjust as needed)
const thisurl = `${API_BASE}/files/metadata`;
const thisbody = JSON.stringify({
  validationCode: validationCode || 'default-code',
  baseFolder: libFolder,
  filePath: 'search.json'
});
    //LoadFolders from search.json on mount, because it has all mfgacronym and mfg names
    fetch(`${API_BASE}/files/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        validationCode: validationCode || 'default-code',
        bucketName: bucket,
        baseFolder: libFolder,
        filePath: 'search.json'
      }),
      signal: controller.signal
    })
    .then(async res => {
      clearTimeout(timeoutId);
      console.log('✅ search.json API response:', res.status, res.statusText);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const text = await res.text();
      console.log('📄 search.json raw response:', text.substring(0, 200) + '...');
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid JSON response from search.json');
      }
      
      // Handle different response formats from file-content endpoint (same as file content handling)
      let searchData;
      if (data && typeof data.content === 'string') {
        // Handle single file response with content property
        try {
          searchData = JSON.parse(data.content);
          console.log('✅ Found data.content (string) for search.json');
        } catch (err) {
          throw new Error('Invalid JSON content in search.json file');
        }
      } else if (typeof data === 'string') {
        // Direct string response - parse as JSON
        try {
          searchData = JSON.parse(data);
          console.log('✅ Parsed direct string response for search.json');
        } catch (err) {
          throw new Error('Invalid JSON string response');
        }
      } else if (Array.isArray(data)) {
        // Direct array response - API returned an array directly
        searchData = data;
        console.log('✅ Found direct array response for search.json with', data.length, 'items');
      } else if (data && typeof data === 'object' && data.Search) {
        // Direct object response with Search property (this is what we're getting)
        searchData = data;
        console.log('✅ Found direct object response with Search property');
      } else if (data && typeof data === 'object') {
        // Generic object response - treat as searchData
        searchData = data;
        console.log('✅ Found generic object response for search.json');
      } else {
        // Log the actual response format for debugging
        console.error('❌ Unexpected search.json response format:', {
          dataType: typeof data,
          isArray: Array.isArray(data),
          isNull: data === null,
          isUndefined: data === undefined,
          keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
          sample: data && typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : String(data)
        });
        throw new Error(`Unexpected response format from search.json. Got ${typeof data}, expected object with 'content' property, string, array, or object with 'Search' property.`);
      }
      
      // Handle the nested structure with "Search" property or direct array
      let searchArray;
      if (searchData && typeof searchData === 'object' && Array.isArray(searchData.Search)) {
        searchArray = searchData.Search;
        console.log('✅ Found nested Search array with', searchArray.length, 'items');
      } else if (Array.isArray(searchData)) {
        // Direct array format - API returned array directly
        searchArray = searchData;
        console.log('✅ Found direct array with', searchArray.length, 'items');
        // Check if items have MfgAcronym property to validate this is the right data
        if (searchArray.length > 0 && searchArray[0] && typeof searchArray[0] === 'object' && 'MfgAcronym' in searchArray[0]) {
          console.log('✅ Confirmed: Array contains MfgAcronym items');
        } else if (searchArray.length > 0) {
          console.warn('⚠️ Array items may not have MfgAcronym property. First item keys:', Object.keys(searchArray[0] || {}));
        }
      } else {
        throw new Error('search.json does not contain a Search array or direct array');
      }
      
      console.log('📊 search.json array length:', searchArray.length);
      
      // Extract unique MfgAcronym values
      const mfgAcronyms = searchArray
        .map((item: unknown) => (item as Record<string, unknown>)?.MfgAcronym)
        .filter((acronym: unknown) => acronym && typeof acronym === 'string')
        .filter((acronym: string, index: number, arr: string[]) => arr.indexOf(acronym) === index) // Remove duplicates
        .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort
      
      console.log('✅ Extracted MfgAcronym folders:', mfgAcronyms.length, 'unique values');
      console.log('📋 Sample MfgAcronyms:', mfgAcronyms.slice(0, 5));
      
      if (mfgAcronyms.length === 0) {
        throw new Error('No valid MfgAcronym values found in search.json');
      }
      
      setFolders(mfgAcronyms);
      
      // Auto-select first non-empty folder if available, otherwise select empty option
      if (mfgAcronyms.length > 0) {
        console.log('🔧 Auto-selecting first MfgAcronym folder:', mfgAcronyms[0]);
        // Prepend libfolder and 'shapes/' to match expected folder structure
        setSelectedFolder(`libfolder-01/shapes/${mfgAcronyms[0]}`);
      } else {
        // If no folders available, select empty option (libfolder-01)
        setSelectedFolder('libfolder-01');
      }
      
      // Calculate and store search.json load time
      const searchJsonEndTime = Date.now();
      const searchJsonLoadTime = searchJsonEndTime - searchJsonStartTime;
      setSearchJsonTime(searchJsonLoadTime);
      console.log(`✅ search.json loaded in ${searchJsonLoadTime}ms`);
      
      // setSearchJsonLoadComplete(true); // Removed - variable deleted
      setLoading(false);
      setError(''); // Clear any previous errors
      
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      console.error('❌ Failed to load search.json:', {
        name: err.name,
        message: err.message,
        cause: err.cause,
        thisurl: thisurl,
        thisbody: thisbody
      });
      
      // Reset the ref so user can retry if needed
      searchJsonLoaded.current = false;
      
      if (err.name === 'AbortError') {
        setError('⚠️ search.json load timeout: Server not responding');
      } else if (err.message.includes('404') || err.message.includes('not found')) {
        setError('⚠️ search.json file not found on server');
      } else if (err.message.includes('Failed to fetch')) {
        setError('⚠️ Network error: Cannot reach API to load search.json');
      } else {
        setError(`⚠️ Failed to load MfgAcronym folders: ${err.message}`);
      }
      
      // Set empty folders on error
      setFolders([]);
      setSelectedFolder('libfolder-01'); // Default to empty folder on error
      // setSearchJsonLoadComplete(false); // Removed - variable deleted
      setLoading(false);
    });
  }, [projectId, bucket, validationCode]); // Depend on projectId, bucket, and validationCode
  */

  // Check write permission
  useEffect(() => {
    // Only check permissions if we have all required values
    if (!validationCode || !libFolder || !bucket) {
      console.log('⏳ Skipping permissions check - missing required values:', {
        validationCode: !!validationCode,
        libFolder: !!libFolder,
        bucket: !!bucket
      });
      return;
    }

    const folderPath = constructFolderPath(selectedRootFolder || '', selectedFolder || '');
    const permissionsRequestBody = { 
      validationCode: validationCode,
      bucketName: bucket,
      baseFolder: libFolder,
      folder: folderPath
    };

    console.log('🔐 Checking permissions with request body:', JSON.stringify(permissionsRequestBody, null, 2));
    console.log('🔐 Permission check details:');
    console.log('  - validationCode:', validationCode);
    console.log('  - bucketName:', bucket);
    console.log('  - baseFolder:', libFolder);
    console.log('  - folderPath:', folderPath);

    fetch(`${API_BASE}/gcs/check-rw-permissions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(permissionsRequestBody)
    })
      .then(async res => {
        console.log('🔐 Permissions check response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Permissions check API error response:', errorText);
          throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('🔐 Permissions check response data:', data);
        const hasWritePermissions = data.canUpload && data.canDelete;
        setWritePermitted(hasWritePermissions);
        
        if (!hasWritePermissions) {
          console.warn('⚠️ Read-only mode: Service account lacks write permissions to bucket');
          console.warn('⚠️ Upload and delete functions will be disabled');
        } else {
          console.log('✅ Write permissions available');
        }
      })
      .catch((err) => {
        console.warn('⚠️ Permissions check failed - operating in read-only mode');
        console.log('🔍 Permission check error details:', err.message);
        setWritePermitted(false);
        // Don't let permissions failure block the UI - continue with read-only mode
      });
  }, [validationCode, libFolder, bucket, selectedFolder, selectedRootFolder]);

  // Load subfolders when root folder selection changes
  useEffect(() => {
    if (!selectedRootFolder || selectedRootFolder === '/' || !projectId || !bucket || !libFolder || !validationCode) {
      // If no root folder selected or root folder is '/', clear subfolders
      console.log('🔄 No root folder selected or root folder is root, clearing subfolders');
      setFolders(['/']); // Just the root option
      setSelectedFolder('/');
      return;
    }
    
    console.log('🔄 Loading subfolders for root folder:', selectedRootFolder);
    setLoading(true);

    // Function to load all folders with pagination support
    const loadAllSubfolders = async () => {
      const allFolders: string[] = [];
      let pageToken: string | null = null;
      let hasMore = true;
      let pageCount = 0;

      try {
        while (hasMore && pageCount < 20) { // Safety limit: max 20 pages
          pageCount++;
          console.log(`📄 Loading subfolder page ${pageCount}...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.error('⏰ Subfolders API request timed out');
          }, 30000);

          const folderPath = constructFolderPath(selectedRootFolder, '');
          
          const subFoldersRequestBody: any = { 
            validationCode: validationCode,
            bucketName: bucket,
            baseFolder: libFolder,
            folder: folderPath,
            limit: 10000
          };

          // Add page token if we have one (for subsequent pages)
          if (pageToken) {
            subFoldersRequestBody.pageToken = pageToken;
            console.log('📄 Using pageToken:', pageToken);
          }
          
          console.log(`📤 Sending subfolders API request (page ${pageCount}):`, JSON.stringify(subFoldersRequestBody, null, 2));
          
          const res = await fetch(`${API_BASE}/gcs/folders-fast`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify(subFoldersRequestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          console.log(`✅ Subfolders API response (page ${pageCount}):`, res.status, res.statusText);
          
          if (!res.ok) {
            const errorText = await res.text();
            console.error('❌ Subfolders API error response:', errorText);
            throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
          }

          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const errorText = await res.text();
            console.error('❌ Subfolders API returned non-JSON:', errorText.substring(0, 200));
            throw new Error(`API returned ${contentType || 'unknown'} content type (expected application/json)`);
          }

          const data = await res.json();
          
          const subFoldersArray = data.folders || [];
          
          // Add folders from this page
          allFolders.push(...subFoldersArray);
          
          // Check for pagination - API may not provide tokens but still have more data
          pageToken = data.nextPageToken || data.pageToken || null;
          const apiHasMore = data.hasMore || false;
          
          // If we got a high number of folders, there might be more
          const likelyMoreFolders = subFoldersArray.length >= 384;
          
          hasMore = !!(pageToken || apiHasMore || likelyMoreFolders);
          
          if (pageToken) {
            console.log(`📄 Loading next page (total so far: ${allFolders.length})...`);
          } else if (apiHasMore) {
            console.log(`📄 API indicates more data (total so far: ${allFolders.length})...`);
          } else if (likelyMoreFolders) {
            // No pagination token provided - API doesn't support pagination
            hasMore = false;
          }
          
          if (!hasMore) {
            console.log(`✅ Loaded ${allFolders.length} folders`);
          }
        }

        if (pageCount >= 20) {
          console.warn('⚠️ Reached maximum page limit (20 pages)');
          setError(`⚠️ Loaded ${allFolders.length} subfolders (may be more)`);
        }

        console.log('✅ Total subfolders loaded:', allFolders.length);
        
        // Format subfolders with '/' prefix and sort case-insensitive
        const formattedSubFolders = allFolders
          .map((folder: string) => '/' + folder.replace(/^\/+/, ''))
          .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        
        // Add '/' as first item (no subfolder)
        const finalSubFolders = ['/', ...formattedSubFolders];
        
        setFolders(finalSubFolders);
        
        // Set first item as default selection
        if (finalSubFolders.length > 0) {
          setSelectedFolder(finalSubFolders[0]);
          console.log('🔧 Auto-selected first subfolder:', finalSubFolders[0]);
        }
        
        setLoading(false);
        
      } catch (err: any) {
        console.error('❌ Failed to load subfolders:', err);
        
        if (err.name === 'AbortError') {
          setError('⚠️ Subfolders load timeout: Server not responding');
        } else {
          setError(`⚠️ Failed to load subfolders: ${err.message}`);
        }
        
        // Set fallback with just the '/' option
        setFolders(['/']);
        setSelectedFolder('/');
        setLoading(false);
      }
    };

    loadAllSubfolders();

    // Reset checked files when root folder changes
    setCheckedFiles([]);
  }, [selectedRootFolder, projectId, bucket, libFolder, validationCode]);

  // Load files when folder selection changes (VSSFolder + RootFolder + Subfolder combination)
  useEffect(() => {
    if (!selectedFolder || !selectedRootFolder || !projectId || !bucket || !libFolder || !validationCode) {
      console.log('⚠️ Missing required values for files load:', { selectedFolder, selectedRootFolder, projectId, bucket, libFolder });
      return;
    }
    
    setLoading(true);
    setError(''); // Clear any previous error/success messages
    
    // Construct the full folder path using utility function
    const fullFolderPath = constructFolderPath(selectedRootFolder, selectedFolder);
    
    console.log('🔍 Loading FILES LIST for combined path:', fullFolderPath);
    console.log('🔧 Constructed folder parameter:', fullFolderPath || '(empty - root level)');
    console.log('📂 VSSFolder:', libFolder, '+ RootFolder:', selectedRootFolder, '+ Subfolder:', selectedFolder);
    console.log('📋 Expected: Only file names, dates, sizes - NOT file contents');
    console.log('🔍 DEBUG - Folder path details:');
    console.log('  - selectedRootFolder:', `"${selectedRootFolder}" (type: ${typeof selectedRootFolder})`);
    console.log('  - selectedFolder:', `"${selectedFolder}" (type: ${typeof selectedFolder})`);
    console.log('  - fullFolderPath:', `"${fullFolderPath}" (type: ${typeof fullFolderPath})`);
    console.log('  - Full API path will be:', `${libFolder}/${fullFolderPath}`);
    
    // Add timeout to prevent infinite loading - start with shorter timeout for testing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('⏰ Files LIST API request timed out - backend not responding');
      console.error('🔧 Possible causes: Backend hanging, subfolder not supported, or server overloaded');
    }, 60000); // Reduced to 1 minute for faster testing
    
    console.log('🚀 Starting fetch request...');
    const fileListStartTime = Date.now();
    
    // Add progress indicators to show we're still waiting
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - fileListStartTime) / 1000);
      console.log(`⏳ Still waiting for response... ${elapsed}s elapsed`);
    }, 15000); // Log every 15 seconds
    // Load filelist using VSSFolder + RootFolder + Subfolder combination
    // Path quoting is now handled in constructFolderPath function
    const requestBody = { 
      validationCode: validationCode || 'default-code',
      bucketName: bucket,
      baseFolder: libFolder,
      folder: fullFolderPath,
      limit: 100000
    };
    
    console.log('📤 Sending files API request body:', JSON.stringify(requestBody, null, 2));
    console.log('🔍 Final folder path:', fullFolderPath);
    console.log('🔍 Expected storage path will be:', `${bucket}/${libFolder}/${fullFolderPath || '(root)'}`);
    
    fetch(`${API_BASE}/gcs/files`, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal 
    })
      .then(res => {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        const responseTime = Date.now() - fileListStartTime;
        console.log(`📡 Files LIST API response: ${res.status} ${res.statusText} (took ${responseTime}ms)`);
        console.log('📍 Request URL was:', res.url);
        console.log('📊 Response headers:', res.headers.get('content-type'), res.headers.get('content-length'));
        
        if (res.status === 404) {
          throw new Error(`Folder "${fullFolderPath}" not found (404). The folder may not exist or the path may be incorrect.`);
        }
        if (res.status === 405) {
          throw new Error(`Method not allowed (405). Server expects POST request.`);
        }
        if (!res.ok) {
          // Log the response body for debugging
          return res.text().then(errorText => {
            console.error('❌ Files API Error Response Body:', errorText);
            console.error('❌ Request was for folder path:', fullFolderPath);
            throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
          });
        }
        return res.json();
      })
      .then(data => {
        const fileCount = data.files?.length || 0;
        console.log('✅ Files LIST API response received, files count:', fileCount);
        console.log('📋 Full API response data:', data);
        console.log('📋 Response data type:', typeof data);
        console.log('📋 Response data keys:', Object.keys(data || {}));
        if (data.files) {
          console.log('📋 Files array length:', data.files.length);
          if (data.files.length > 0) {
            console.log('📋 First file sample:', data.files[0]);
          }
        } else {
          console.log('📋 No files array in response!');
        }
        
        // Check for potential pagination/truncation issues
        if (fileCount === 1000) {
          console.warn('⚠️ WARNING: Exactly 1000 files returned - this may indicate pagination limit!');
          console.warn('⚠️ Backend may be truncating results. Check if more files exist.');
        } else if (fileCount === 0) {
          console.warn('⚠️ No files returned - folder may be empty or inaccessible');
        } else if (fileCount > 500) {
          console.log('📊 Large folder detected:', fileCount, 'files');
        }
        
        // Check for pagination indicators in response
        if (data.nextPageToken || data.pageToken || data.hasMore || data.truncated) {
          console.warn('⚠️ PAGINATION DETECTED: Response indicates more files available!');
          console.warn('⚠️ Pagination fields:', {
            nextPageToken: data.nextPageToken,
            pageToken: data.pageToken, 
            hasMore: data.hasMore,
            truncated: data.truncated
          });
        }
        
        // Validate we're getting metadata only, not file contents
        if (data.files?.length > 0) {
          const firstFile = data.files[0];
          if (firstFile.content !== undefined) {
            console.warn('⚠️ WARNING: API returned file CONTENTS, not just metadata! This explains the timeout.');
            console.warn('⚠️ First file content length:', firstFile.content?.length || 'N/A');
          } else {
            console.log('✅ Confirmed: API returned metadata only (no content field)');
          }
        }
        
        const files = Array.isArray(data.files) ? data.files : [];
        const mappedFiles = mapApiFilesToFileItems(files);
        
        setFiles(mappedFiles);
        
        // Store file list load time (recalculate since responseTime is from earlier scope)
        const fileListLoadTime = Date.now() - fileListStartTime;
        setFileListTime(fileListLoadTime);
        console.log(`✅ File list loaded in ${fileListLoadTime}ms`);
        
        // Set UI warnings for pagination issues
        if (mappedFiles.length === 1000) {
          setError('⚠️ Showing 1000 files - there may be more files not displayed due to pagination limits');
        } else if (data.nextPageToken || data.pageToken || data.hasMore || data.truncated) {
          setError('⚠️ This folder contains more files than displayed - pagination detected');
        }
        
        setCheckedFiles([]);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        const responseTime = Date.now() - fileListStartTime;
        console.error(`❌ Failed to load files for folder: ${fullFolderPath} (after ${responseTime}ms)`);
        console.error('❌ Error details:', err);
        
        if (err.name === 'AbortError') {
          setError('Request timeout: The server took too long to respond');
        } else {
          setError(`Failed to load files for "${fullFolderPath}": ${err.message}`);
        }
        setFiles([]);
        setLoading(false);
      });
  }, [selectedFolder, selectedRootFolder, projectId, bucket, libFolder, validationCode, refreshTrigger]);

  // Sort files when sortConfig changes
  useEffect(() => {
    if (!sortConfig) return;
    setLoading(true);
    setTimeout(() => {
      setFiles(prevFiles => {
        const sorted = [...prevFiles].sort((a, b) => {
          let aVal = a[sortConfig.key];
          let bVal = b[sortConfig.key];
          if (sortConfig.key === 'updated') {
            aVal = aVal ? new Date(aVal as string).toISOString() : '';
            bVal = bVal ? new Date(bVal as string).toISOString() : '';
          }
          if (sortConfig.key === 'size') {
            aVal = typeof aVal === 'number' ? aVal : 0;
            bVal = typeof bVal === 'number' ? bVal : 0;
          }
          if (aVal === undefined) aVal = '';
          if (bVal === undefined) bVal = '';
          
          // Use case-insensitive comparison for string fields (like 'name')
          if (sortConfig.key === 'name' && typeof aVal === 'string' && typeof bVal === 'string') {
            const comparison = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
            return sortConfig.direction === 'asc' ? comparison : -comparison;
          }
          
          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
        return sorted;
      });
      setLoading(false);
    }, 300); // Simulate loading
  }, [sortConfig]);

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setError(''); // Clear any previous error/success messages
    const newFolder = e.target.value;
    setSelectedFolder(newFolder); // Directly use the formatted folder value
    setCheckedFiles([]); // Clear selected files when folder changes
    console.log('🔄 Subfolder changed to:', newFolder);
  };



  // Utility function to construct folder path properly
  // This creates the relative path within the baseFolder for the CloudRun API
  const constructFolderPath = (rootFolder: string, subFolder: string): string => {
    console.log('🔧 constructFolderPath called with:', { rootFolder, subFolder });
    
    // If both are root/empty, return empty string (means root of baseFolder)
    if ((!rootFolder || rootFolder === '/') && (!subFolder || subFolder === '/')) {
      console.log('🔧 Both root and subfolder are empty, returning empty string for baseFolder root');
      return '';
    }
    
    // If no subfolder or subfolder is root, just use the root folder
    if (!subFolder || subFolder === '/') {
      let result = rootFolder && rootFolder !== '/' ? rootFolder.replace(/^\/+/, '') : '';
      // Remove trailing slashes for consistency
      result = result.replace(/\/+$/, '');
      console.log('🔧 No subfolder, using root folder as path:', result);
      return result;
    }
    
    // Clean the subfolder path
    const cleanSubFolder = subFolder.replace(/^\/+/, ''); // Remove leading slashes
    console.log('🔧 Cleaned subfolder:', cleanSubFolder);
    
    // If the subfolder already contains the root folder, don't combine them
    if (rootFolder && rootFolder !== '/' && cleanSubFolder.startsWith(rootFolder.replace(/^\/+/, ''))) {
      console.log('🔧 Subfolder already contains root folder, using subfolder directly:', cleanSubFolder);
      return cleanSubFolder;
    }
    
    // Otherwise, combine root folder and subfolder
    let fullPath = '';
    if (rootFolder && rootFolder !== '/') {
      const cleanRootFolder = rootFolder.replace(/^\/+/, '');
      fullPath = cleanRootFolder + '/' + cleanSubFolder;
      console.log('🔧 Combined root and subfolder:', fullPath);
    } else {
      fullPath = cleanSubFolder;
      console.log('🔧 Used subfolder as path:', fullPath);
    }
    
    // Path sanitization to prevent path traversal issues
    const sanitizedPath = fullPath
      .split('/') // Split into components  
      .filter(component => component !== '' && component !== '.' && component !== '..') // Remove empty, ., and .. components
      .join('/') // Rejoin with single slashes
      .replace(/\/+/g, '/') // Replace any remaining multiple slashes with single slash
      .replace(/\/$/, ''); // Remove trailing slash to prevent double slashes when combining with filenames
    
    console.log('🔧 Final constructed path:', sanitizedPath);
    return sanitizedPath;
  };

  const handleRootFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setError(''); // Clear any previous error/success messages
    const newRootFolder = e.target.value;
    setSelectedRootFolder(newRootFolder);
    // Reset subfolder to '/' (first entry) when root folder changes
    setSelectedFolder('/');
    setCheckedFiles([]);
    console.log('🔄 Root folder changed to:', newRootFolder);
    console.log('↩️ Subfolder reset to: /');
  };

  const handleCheckFile = (name: string) => {
    setError(''); // Clear any previous error/success messages
    setCheckedFiles(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
  };

  // const handleFileCheck = (filename: string) => {
  //   setCheckedFiles((prev: string[]) =>
  //     prev.includes(filename)
  //       ? prev.filter((f) => f !== filename)
  //       : [...prev, filename]
  //   );
  // };

  const handleDownload = async () => {
    setError(''); // Clear any previous success/error messages
    setIsDownloading(true);
    try {
      let successCount = 0;
      for (const file of checkedFiles) {
        // Strip everything before last / to get just the filename
        const fileName = file.substring(file.lastIndexOf('/') + 1);
        
        console.log('🔽 Downloading file:', fileName);
        console.log('📂 From folder:', selectedFolder);
        console.log('📁 Is subfolder download:', selectedFolder.includes('/'));

        // Add timeout for larger files (2 minutes)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error('⏰ Download timeout for:', fileName);
        }, 120000);

        try {
          console.log('🚀 Starting download fetch for:', fileName);
          const res = await fetch(`${API_BASE}/files/download/single`, { 
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
              validationCode: validationCode || 'default-code',
              bucketName: bucket,
              baseFolder: libFolder,
              filePath: (() => {
                const folderPath = constructFolderPath(selectedRootFolder, selectedFolder);
                return folderPath ? 
                  (folderPath.endsWith('/') ? folderPath + fileName : folderPath + '/' + fileName) : 
                  fileName;
              })()
            }),
            signal: controller.signal 
          });
          clearTimeout(timeoutId);
          console.log(`📡 Download response: ${res.status} ${res.statusText} for ${fileName}`);
          
          if (!res.ok) {
            console.error(`❌ Download failed: ${res.status} ${res.statusText}`);
            console.error('❌ Failed for file:', fileName);
            setError(`Failed to download file: ${fileName} (${res.status})`);
            continue;
          }
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file;
          a.click();
          window.URL.revokeObjectURL(url);
          successCount++;
        } catch (fileErr) {
          clearTimeout(timeoutId);
          if (fileErr instanceof Error && fileErr.name === 'AbortError') {
            setError(`Download timeout for file: ${fileName}`);
          } else {
            setError(`Failed to download file: ${fileName}`);
          }
          continue;
        }
      }
      if (successCount === checkedFiles.length) {
        // Include timing information in success message
        const timingInfo = [];
        // if (searchJsonTime) timingInfo.push(`search.json: ${searchJsonTime}ms`); // Removed
        if (fileListTime) timingInfo.push(`file list: ${fileListTime}ms`);
        const timingText = timingInfo.length > 0 ? ` (Load times - ${timingInfo.join(', ')})` : '';
        setError(`Files downloaded successfully${timingText}`);
      }
    } catch (err) {
      setError(`Failed to download files: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    // Confirmation prompt before deleting
    const fileCount = checkedFiles.length;
    const fileList = checkedFiles.slice(0, 5).join(', ') + (fileCount > 5 ? `, and ${fileCount - 5} more...` : '');
    const confirmMessage = `Are you sure you want to delete ${fileCount} file${fileCount > 1 ? 's' : ''}?\n\n${fileList}\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return; // User cancelled
    }

    setLoading(true);
    try {
      console.log('🗑️ Deleting files:', checkedFiles);
      console.log('  Bucket:', bucket);
      console.log('  BaseFolder:', libFolder);
      
      const response = await fetch(`${API_BASE}/gcs/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          validationCode: validationCode || 'default-code',
          bucketName: bucket,
          baseFolder: libFolder,
          files: checkedFiles // Already contains full paths from fullPath field
        })
      });
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to delete files');
        } else {
          setError(`Failed to delete files: ${response.status} ${response.statusText}`);
        }
        setLoading(false);
        return;
      }
      setCheckedFiles([]);
      setError('');
      
      console.log('✅ Files deleted successfully, refreshing file list...');
      
      // Trigger file list reload using the same mechanism as upload
      setRefreshTrigger(prev => prev + 1);
      
      // Show success message
      alert(`✅ Delete Successful!\n\n${fileCount} file${fileCount > 1 ? 's' : ''} deleted.`);
      
      setLoading(false);
    } catch (err) {
      console.error('❌ Delete failed:', err);
      setError('Failed to delete files');
      setLoading(false);
    }
  };

  const handleUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = e.target.files;
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    const sourcePath = `Local files: ${fileNames}`;
    // Use constructFolderPath to get the proper relative path within baseFolder
    const targetPath = constructFolderPath(selectedRootFolder, selectedFolder);
    // Create display path showing full storage location
    const displayPath = libFolder + (targetPath ? '/' + targetPath : '');
    
    setUploadData({
      files: files,
      isFolder: false,
      sourcePath,
      targetPath,
      displayPath
    });
    setShowUploadConfirm(true);
  };

  const handleUploadFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = e.target.files;
    // Get the first file's path to determine the folder name
    const firstFile = files[0];
    const folderName = firstFile.webkitRelativePath?.split('/')[0] || 'Unknown Folder';
    const sourcePath = `Local folder: ${folderName} (${files.length} files)`;
    // Use constructFolderPath to get the proper relative path within baseFolder
    const targetPath = constructFolderPath(selectedRootFolder, selectedFolder);
    // Create display path showing full storage location
    const displayPath = libFolder + (targetPath ? '/' + targetPath : '');
    
    setUploadData({
      files: files,
      isFolder: true,
      sourcePath,
      targetPath,
      displayPath
    });
    setShowUploadConfirm(true);
  };

  const executeUpload = async () => {
    if (!uploadData) return;
    
    setShowUploadConfirm(false);
    setIsUploading(true);
    setError('');
    
    try {
      console.log('📤 Starting upload...');
      console.log('  uploadData.targetPath:', uploadData.targetPath);
      console.log('  uploadData.displayPath:', uploadData.displayPath);
      console.log('  bucketName:', bucket);
      console.log('  baseFolder:', libFolder);
      
      // Check for duplicate files first
      const filesToUpload = Array.from(uploadData.files || []);
      const duplicateFiles = filesToUpload.filter(file => 
        files.some(existingFile => existingFile.name === file.name)
      );
      
      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(f => f.name).join('\n  - ');
        const errorMsg = `❌ Cannot upload - the following file(s) already exist:\n\n  - ${duplicateNames}\n\nPlease rename or delete the existing file(s) first.`;
        setError(errorMsg);
        setIsUploading(false);
        setUploadData(null);
        alert(errorMsg);
        return;
      }
      
      // Convert files to base64 for Cloud Run API
      const filesData = [];
      for (const file of filesToUpload) {
        const base64Content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:type;base64, prefix
          };
          reader.readAsDataURL(file);
        });
        
        // Construct file path properly: remove trailing slash from targetPath before adding file name
        let filePath: string;
        if (uploadData.targetPath) {
          const cleanPath = uploadData.targetPath.replace(/\/+$/, ''); // Remove trailing slashes
          filePath = cleanPath ? `${cleanPath}/${file.name}` : file.name;
        } else {
          filePath = file.name;
        }
        
        console.log('  📄 File path for', file.name, ':', filePath);
        
        filesData.push({
          filePath: filePath,
          content: base64Content,
          contentType: file.type || 'application/octet-stream'
        });
      }
      
      console.log('📋 Total files to upload:', filesData.length);
      console.log('🌐 Upload endpoint:', `${API_BASE}/files/upload/multiple`);
      
      const endpoint = uploadData.isFolder ? 'files/upload/multiple' : 'files/upload/multiple';
      const requestBody = {
        validationCode: validationCode || 'default-code',
        bucketName: bucket,
        baseFolder: libFolder,
        files: filesData.map(f => ({ filePath: f.filePath, contentType: f.contentType, contentLength: f.content.length }))
      };
      console.log('📤 Request body (without content):', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationCode: validationCode || 'default-code',
          bucketName: bucket,
          baseFolder: libFolder,
          files: filesData
        })
      });
      
      console.log('📡 Upload response status:', response.status);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          console.error('❌ Upload failed:', errorData);
          setError(errorData.error || `Failed to upload ${uploadData.isFolder ? 'folder' : 'files'}`);
        } else {
          setError(`Upload failed: ${response.status} ${response.statusText}`);
        }
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Upload API returned non-JSON:', contentType);
        setError('Upload API returned invalid response format');
        return;
      }
      
      const uploadResult = await response.json();
      console.log('✅ Upload API response:', uploadResult);
      console.log('  Response structure:', Object.keys(uploadResult));
      
      // Check if upload actually succeeded
      if (uploadResult.success === false || uploadResult.error) {
        console.error('❌ Upload API reported failure:', uploadResult.error || uploadResult.message);
        setError(uploadResult.error || uploadResult.message || 'Upload failed');
        setIsUploading(false);
        setUploadData(null);
        return;
      }
      
      // Check if upload result contains file locations
      if (uploadResult.uploadedFiles && Array.isArray(uploadResult.uploadedFiles)) {
        console.log('📍 Uploaded files locations:', uploadResult.uploadedFiles);
        uploadResult.uploadedFiles.forEach((file: any, idx: number) => {
          console.log(`  [${idx}] ${file.filePath || file.name || 'unknown'}`);
        });
        
        // Check if any uploads failed
        const failedFiles = uploadResult.uploadedFiles.filter((f: any) => f.success === false || f.error);
        if (failedFiles.length > 0) {
          console.error('❌ Some files failed to upload:', failedFiles);
          const failedNames = failedFiles.map((f: any) => f.name || f.filePath).join(', ');
          setError(`Some files failed to upload: ${failedNames}`);
          setIsUploading(false);
          setUploadData(null);
          return;
        }
      }
      
      const uploadedCount = filesData.length;
      const uploadLocation = uploadData.displayPath;
      
      // VERIFY UPLOAD: Try to download the first uploaded file to confirm it exists
      console.log('🔍 VERIFICATION: Attempting to download uploaded file to confirm it exists...');
      const firstFileData = filesData[0];
      const verifyFilePath = firstFileData.filePath;
      console.log('  Verifying file path:', verifyFilePath);
      console.log('  Upload request was to:', `${libFolder}/${verifyFilePath}`);
      
      try {
        const verifyResponse = await fetch(`${API_BASE}/files/download/single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            validationCode: validationCode || 'default-code',
            bucketName: bucket,
            baseFolder: libFolder,
            filePath: verifyFilePath
          })
        });
        
        console.log('📥 Download verification response:', verifyResponse.status, verifyResponse.statusText);
        
        if (verifyResponse.ok) {
          // File exists! Download API returns binary content, not JSON
          // We don't need to parse it, just knowing status=200 means file exists
          const contentType = verifyResponse.headers.get('content-type');
          const contentLength = verifyResponse.headers.get('content-length');
          console.log('✅ FILE EXISTS! Download verification successful');
          console.log('  Content-Type:', contentType);
          console.log('  Content-Length:', contentLength, 'bytes');
          console.log('  File successfully uploaded and verified!');
        } else {
          const errorText = await verifyResponse.text();
          console.error('❌ FILE NOT FOUND! Download verification failed:', verifyResponse.status);
          console.error('  Error response:', errorText);
          console.error('  🚨 CRITICAL: Upload API reported success but file cannot be downloaded!');
          console.error('  🔍 This indicates the upload actually FAILED silently');
          
          // Show error to user
          setError(`Upload failed: File was not saved to storage. The upload API reported success but the file does not exist at the expected location.\n\nAttempted path: ${libFolder}/${verifyFilePath}`);
          setIsUploading(false);
          setUploadData(null);
          return; // Stop here, don't try to refresh
        }
      } catch (verifyErr) {
        console.error('❌ Download verification error:', verifyErr);
      }
      
      console.log('⏳ Waiting 5 seconds before triggering file list reload (GCS list consistency)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Force complete reload of file list by triggering useEffect
      console.log('� Triggering complete file list reload via useEffect...');
      setRefreshTrigger(prev => prev + 1);
      
      // Show success message
      alert(`✅ Upload Successful!\n\nFiles uploaded: ${uploadedCount}\nDestination: ${uploadLocation}\n\nThe file list will refresh automatically.`);
      setError(''); // Clear any previous errors
    } catch (err) {
      setError(`Failed to upload ${uploadData.isFolder ? 'folder' : 'files'}`);
    } finally {
      setIsUploading(false);
      setUploadData(null);
    }
  };

  const handleCancelUpload = () => {
    setShowUploadConfirm(false);
    setUploadData(null);
  };

console.log('LibBucket render state:', {
  projectId, bucket, folders: folders.length, selectedFolder, 
  files: files.length, checkedFiles: checkedFiles.length, 
  writePermitted, loading, error
});
////////////////////////////////////////////////////////////////////////////

  // Sorting handler
  const handleSort = (key: keyof FileItem) => {
    setSortConfig(prev => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const isWaiting = loading || isDownloading || popupLoading || isUploading;
  const buttonsDisabled = !true /* searchJsonLoadComplete removed */ || loading || isDownloading || isUploading;

  return (
    <div className={`dls-bucket${isWaiting ? ' cursor-wait' : ''}`}>
      <div className="dls-config-grid">
        <div className="dls-hidden">
          <label className="dls-label">Validation Code</label>
          <div className="dls-display-value">{validationCode}</div>
        </div>
        <div className="dls-hidden">
          <label className="dls-label">ProjectId</label>
          <div className="dls-display-value">{projectId}</div>
        </div>
        <div>
          <label className="dls-label">Bucket</label>
          <div className="dls-display-value">{bucket}</div>
        </div>
        <div>
          <label className="dls-label">VSSFolder</label>
          <div className="dls-display-value">{libFolder}</div>
        </div>
        <div className="dls-config-item">
          <label className="dls-label">
            RootFolders ({rootFolders.length} {rootFolders.length === 1 ? 'item' : 'items'})
          </label>
          <select
            value={selectedRootFolder}
            onChange={handleRootFolderChange}
            className="dls-select"
          >
            {rootFolders.map((rootFolder) => (
              <option key={rootFolder} value={rootFolder}>
                {rootFolder === '/' ? '(No root folder)' : rootFolder}
              </option>
            ))}
          </select>
        </div>
        <div className="dls-config-item">
          <label className="dls-label">
            Subfolders ({folders.length} {folders.length === 1 ? 'item' : 'items'})
          </label>
          <select
            value={selectedFolder}
            onChange={handleFolderChange}
            className="dls-select"
          >
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder === '/' ? '(No subfolder)' : folder}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact Single Row: Folder Info, Stats, and Buttons */}
      <div className="dls-toolbar">
        <div className="dls-toolbar-inner">
          <div className="dls-toolbar-left">
            <div className="dls-toolbar-title-group">
              <h3 className="dls-folder-title">
                Files in folder: {
                  (() => {
                    const folderPath = constructFolderPath(selectedRootFolder, selectedFolder);
                    return folderPath ? `${libFolder}/${folderPath}` : libFolder;
                  })()
                }
              </h3>
              <div className="dls-export-btns">
                <button
                  onClick={() => {
                    const folderPath = constructFolderPath(selectedRootFolder, selectedFolder);
                    const filename = `stencils_${folderPath ? folderPath.replace(/\//g, '_') : 'root'}_${new Date().toISOString().slice(0, 10)}`;
                    exportToCSV(files, filename);
                  }}
                  disabled={files.length === 0}
                  className="dls-export-btn csv"
                  title={files.length === 0 ? "No files to download" : "Download as CSV"}
                >
                  <ArrowDownTrayIcon className="dls-icon-sm" />
                </button>
                <button
                  onClick={() => {
                    const folderPath = constructFolderPath(selectedRootFolder, selectedFolder);
                    const filename = `stencils_${folderPath ? folderPath.replace(/\//g, '_') : 'root'}_${new Date().toISOString().slice(0, 10)}`;
                    exportToExcel(files, filename);
                  }}
                  disabled={files.length === 0}
                  className="dls-export-btn excel"
                  title={files.length === 0 ? "No files to download" : "Download as Excel"}
                >
                  <ArrowDownTrayIcon className="dls-icon-sm" />
                </button>
              </div>
            </div>
            {loading ? (
              <div className="dls-loading-indicator">
                <div className="dls-spinner-sm"></div>
                <span className="dls-loading-text">Loading...</span>
              </div>
            ) : (
              <div className="dls-stats">
                <span className="dls-badge files">
                  📄 {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
                {checkedFiles.length > 0 && (
                  <span className="dls-badge selected">
                    ✓ {checkedFiles.length} selected
                  </span>
                )}
                {fileListTime && (
                  <span className="dls-badge timing">
                    ⏱️ L:{fileListTime}ms
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div className="dls-action-btns">
            <button
              className="dls-action-btn download"
              onClick={handleDownload}
              disabled={buttonsDisabled || checkedFiles.length === 0}
              title={isDownloading ? 'Downloading selected files...' : 'Download selected files'}
            >
              {isDownloading ? <div className="dls-spinner-white"></div> : <span>⬇️</span>}
            </button>
            <button
              className="dls-action-btn delete"
              onClick={handleDelete}
              disabled={buttonsDisabled || !writePermitted || checkedFiles.length === 0}
              title={loading ? 'Deleting selected files...' : 'Delete selected files'}
            >
              {loading ? <div className="dls-spinner-white"></div> : <span>🗑️</span>}
            </button>
            <label
              className={`dls-upload-label${buttonsDisabled || !writePermitted ? ' disabled-upload' : ''}`}
              title={isUploading ? 'Uploading folder...' : 'Upload folder'}
            >
              {isUploading ? <div className="dls-spinner-white"></div> : <span>📁</span>}
              <input
                id="upload-folder"
                type="file"
                name="files"
                multiple
                className="dls-hidden"
                ref={el => { if (el) el.setAttribute('webkitdirectory', ''); }}
                onChange={handleUploadFolder}
                disabled={buttonsDisabled || !writePermitted}
              />
            </label>
            <label
              className={`dls-upload-label${buttonsDisabled || !writePermitted ? ' disabled-upload' : ''}`}
              title={isUploading ? 'Uploading files...' : 'Upload files'}
            >
              {isUploading ? <div className="dls-spinner-white"></div> : <span>📄</span>}
              <input id="upload-files" type="file" multiple className="dls-hidden" onChange={handleUploadFiles} disabled={buttonsDisabled || !writePermitted} />
            </label>
          </div>
        </div>
      </div>

      {/* Scrollable table container */}
      <div className="dls-table-container">
        <table className="dls-table">
          <thead className="dls-thead">
            <tr style={{ height: '32px' }}>
              <th className="dls-th checkbox">✓</th>
              <th className="dls-th sortable" onClick={() => handleSort('name')}>
                📁 Filename
                {sortConfig?.key === 'name' && (
                  <span className="dls-sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
              <th className="dls-th sortable" onClick={() => handleSort('updated')}>
                📅 Date
                {sortConfig?.key === 'updated' && (
                  <span className="dls-sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
              <th className="dls-th sortable" onClick={() => handleSort('size')}>
                📊 Size
                {sortConfig?.key === 'size' && (
                  <span className="dls-sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="dls-tbody">
            {files.map((file, index) => (
              <tr key={file.name} className={`dls-tr ${index % 2 === 0 ? 'even' : 'odd'}`} style={{ height: '32px' }}>
                <td className="dls-td checkbox">
                  <input
                    type="checkbox"
                    checked={checkedFiles.includes(file.fullPath || file.name)}
                    onChange={() => handleCheckFile(file.fullPath || file.name)}
                    className="dls-checkbox"
                  />
                </td>
                <td
                  className="dls-td filename"
                  onDoubleClick={e => handleFilenameClick(file, e)}
                  onClick={e => handleFilenameClick(file, e)}
                  title="Double-click or Ctrl+Click to view JSON"
                >
                  📄 {file.name}
                </td>
                <td className="dls-td">{
                  (() => {
                    const d = new Date(file.updated);
                    if (isNaN(d.getTime())) return file.updated;
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const mm = pad(d.getMonth() + 1);
                    const dd = pad(d.getDate());
                    const yyyy = d.getFullYear();
                    const hh = pad(d.getHours());
                    const min = pad(d.getMinutes());
                    const ss = pad(d.getSeconds());
                    return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
                  })()
                }</td>
                <td className="dls-td">{typeof file.size === 'number' ? file.size.toLocaleString() + ' bytes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error message at bottom */}
      {error && <div className="dls-error">{error}</div>}

      {/* Upload Confirmation Popup */}
      {showUploadConfirm && uploadData && (
        <div className="dls-modal-overlay">
          <div className="dls-modal upload">
            <div className="dls-modal-header upload">
              <h3 className="dls-modal-title">🔄 Confirm Upload</h3>
            </div>
            <div className="dls-modal-body">
              <div className="dls-upload-info-wrap">
                <div className="dls-upload-info">
                  <p><strong>Source:</strong> {uploadData.sourcePath}</p>
                  <p><strong>Destination:</strong> {uploadData.displayPath}</p>
                </div>
              </div>
              <div className="dls-modal-footer">
                <button className="dls-btn-cancel" onClick={handleCancelUpload}>Cancel</button>
                <button className="dls-btn-confirm" onClick={executeUpload}>Confirm Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup for JSON/metadata viewer */}
      {popupFile && (
        <div className="dls-modal-overlay">
          <div className="dls-modal viewer">
            <div className="dls-modal-header viewer">
              <h3 className="dls-modal-title">📋 Metadata for File: {popupFile}</h3>
              <button className="dls-modal-close" onClick={handleClosePopup} title="Close">×</button>
            </div>
            <div className="dls-modal-body">
              {popupLoading && (
                <div className="dls-viewer-loading">
                  <div className="dls-spinner-lg"></div>
                  <span className="dls-viewer-loading-text">Loading file content...</span>
                </div>
              )}
              {popupError && (
                <div className="dls-viewer-error">
                  <div className="dls-viewer-error-title">❌ Error</div>
                  <div className="dls-viewer-error-msg">{popupError}</div>
                </div>
              )}
              {!popupLoading && !popupError && popupContent && (
                <pre className="dls-viewer-content">{popupContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export {VisioStencilsBucket}
