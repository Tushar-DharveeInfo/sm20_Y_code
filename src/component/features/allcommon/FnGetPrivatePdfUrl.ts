/* Builds the browser url for a document in public/privatepdf.
   The shipped file names contain spaces, so the name must be encoded
   before pdf.js can fetch it. Absolute urls are passed through as is. */
const FnGetPrivatePdfUrl = (fileName: string): string => {
    let documentName = fileName.trim().replace(/^\/+/, "");

    if (/^(https?:)?\/\//i.test(documentName)) {
        return documentName;
    }

    // Map cloud filenames to local filenames
    if (documentName === "eula-service.pdf" || documentName === "NetZoom End User License Agreement.pdf") {
        documentName = "NetZoom End User License Agreement.pdf";
    } else if (documentName === "brochure-netzoom.pdf" || documentName === "NetZoom Enterprise Brochure.pdf") {
        documentName = "NetZoom Enterprise Brochure.pdf";
    } else if (documentName === "brochure-visiostencils.pdf" || documentName === "Visio Stencils Brochure.pdf") {
        documentName = "Visio Stencils Brochure.pdf";
    } else if (documentName === "knowledge-base.pdf" || documentName === "Knowledge Base.pdf") {
        documentName = "Knowledge Base.pdf";
    } else if (documentName === "about-netzoom.pdf" || documentName === "About NetZoom.pdf") {
        documentName = "About NetZoom.pdf";
    }

    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
    const folder = "privatepdf";

    return `${baseUrl}${folder}/${encodeURIComponent(documentName)}`;
};

export { FnGetPrivatePdfUrl };
export default FnGetPrivatePdfUrl;
