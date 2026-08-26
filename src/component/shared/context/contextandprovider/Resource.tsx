import { useState, createContext, useMemo, useEffect } from "react";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { IResource } from "../allinterface/IResource";

const ResourceContext = createContext<IResource | undefined>(undefined);

//Chart API and Chart Profile
const PRIVATE_CHARTS_BASE = 'privatecharts';
const CHART_PROFILE_FILE = `${PRIVATE_CHARTS_BASE}/ChartProfile.json`;
const CHART_API_FILE = `${PRIVATE_CHARTS_BASE}/ChartAPI.json`;

// Report API and Report Profile
const PRIVATE_REPORT_TEMPLATES_BASE = '/privatereporttemplates';
const REPORT_PROFILE_FILE = `${PRIVATE_REPORT_TEMPLATES_BASE}/ReportProfile.json`;
const REPORT_LAYOUT_FILE = `${PRIVATE_REPORT_TEMPLATES_BASE}/ReportLayout.json`;
const ORDER_FORM = `${PRIVATE_REPORT_TEMPLATES_BASE}/OrderForm.json`;
const PROFORMA_INVOICE = `${PRIVATE_REPORT_TEMPLATES_BASE}/ProformaInvoice.json`;
const QUOTE_FORM = `${PRIVATE_REPORT_TEMPLATES_BASE}/QuoteForm.json`;

function ResourceProvider({ children }: IAppContextWrapper) {
    const [chartApiJson, setChartApiJson] = useState<unknown>();
    const [chartProfileJson, setChartProfileJson] = useState<unknown>();
    const [reportProfileJson, setReportProfileJson] = useState<unknown>();
    const [reportLayoutJson, setReportLayoutJson] = useState<unknown>();
    const [orderFormJson, setOrderFormJson] = useState<unknown>();
    const [proformaInvoiceJson, setProformaInvoiceJson] = useState<unknown>();
    const [quoteFormJson, setQuoteFormJson] = useState<unknown>();


    const FnGetJsonFromPublicFolder = async (filePath: string) => {
        const path = filePath.startsWith('/') ? filePath : `/${filePath}`;

        try {
            let response = await fetch(path);

            if (!response.ok) {
                const lowerPath = path.toLowerCase();
                if (lowerPath !== path) {
                    response = await fetch(lowerPath);
                }
            }

            if (!response.ok) {
                console.warn(`Failed to load ${filePath} (${response.status})`);
                return undefined;
            }

            return await response.json();
        } catch (err) {
            console.warn(`Error loading ${filePath}:`, err);
            return undefined;
        }
    };

    useEffect(() => {
        // Chart API, Chart Profile, and Report Template Data
        void FnGetJsonFromPublicFolder(CHART_API_FILE).then((data) => data && setChartApiJson(data));
        void FnGetJsonFromPublicFolder(CHART_PROFILE_FILE).then((data) => data && setChartProfileJson(data));

        void FnGetJsonFromPublicFolder(REPORT_PROFILE_FILE).then((data) => data && setReportProfileJson(data));
        void FnGetJsonFromPublicFolder(REPORT_LAYOUT_FILE).then((data) => data && setReportLayoutJson(data));
        void FnGetJsonFromPublicFolder(ORDER_FORM).then((data) => data && setOrderFormJson(data));
        void FnGetJsonFromPublicFolder(PROFORMA_INVOICE).then((data) => data && setProformaInvoiceJson(data));
        void FnGetJsonFromPublicFolder(QUOTE_FORM).then((data) => data && setQuoteFormJson(data));
    }, []);


    const providers: IResource = useMemo(() => ({
        chartApiJson,
        setChartApiJson,
        chartProfileJson,
        setChartProfileJson,
        reportProfileJson,
        setReportProfileJson,
        reportLayoutJson,
        setReportLayoutJson,
        orderFormJson,
        setOrderFormJson,
        proformaInvoiceJson,
        setProformaInvoiceJson,
        quoteFormJson,
        setQuoteFormJson
    }), [
        chartApiJson,
        chartProfileJson,
        reportProfileJson,
        reportLayoutJson,
        orderFormJson,
        proformaInvoiceJson,
        quoteFormJson
    ]);

    return (
        <ResourceContext.Provider value={providers} >
            {children}
        </ResourceContext.Provider>
    );
}

export { ResourceContext };
export { ResourceProvider };
