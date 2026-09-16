import { useResourceContext } from '../context/hooks/ResourceHooks';
import { Loader } from '../loader/Loader';
import { ITreeNode } from '../allinterface/tree/ITreeControl';
import { GenerateReport } from './GenerateReport';
import { TReportAddressFields, TReportDataset, TReportDocTypeInput } from '../../features/allcommon/FnBuildReportLayoutConfig';

export interface IGenerateReportHostProps {
    selectedNode?: ITreeNode;
}


const sampleOrderAddressFields: TReportAddressFields = {
    contact: [
        "Jared Barta, UnityPoint Health",
        "3851 River Ridge Drive NE",
        "Cedar Rapids, IA 52402, United States",
        "Phone: 319-739-2838",
        "jared.barta@unitypoint.org",
    ].join("\n"),
    From: [
        "Uriel Campos, NetZoom, Inc.",
        "3030 Warrenville Road, Suite 225",
        "Lisle, IL 60532, United States",
        "Phone: 630-281-6464 x6260",
        "Uriel@NetZoom.com",
    ].join("\n"),
    billto: [
        "Accounts Payable, UnityPoint Health",
        "PO Box 5048",
        "Rock Island, IL 61204, United States",
        "Phone: 877-547-5757",
        "APInvoices@unitypoint.org",
    ].join("\n"),
    shipto: [
        "Jayson Kramer, UnityPoint Health",
        "3851 River Ridge Dr NE",
        "Cedar Rapids, IA 52402-7531, United States",
        "Phone: 319-739-2603",
        "Jayson.Kramer@unitypoint.org",
    ].join("\n"),
};

const sampleOrderDocType: TReportDocTypeInput = {
    doctype: {
        Invoice: "1754",
        Quote: "Q-2023-001",
        PO: "4500123456",
    },
};

const sampleOrderDataset1: TReportDataset = {
    _Orders: [
        {
            Qty: 1,
            Product: "NZ-ENT-001\nNetZoom Enterprise Subscription",
            Price: 12500,
            Amount: 12500,
        },
        {
            Qty: 2,
            Product: "NZ-VISIO-100\nVisio Stencils License Pack",
            Price: 2500,
            Amount: 5000,
        },
    ],
};

const sampleOrderDataset2: TReportDataset = {
    _Totals: [
        {
            SubTotal: 17500,
            Total: 17500,
        },
    ],
};


const GenerateReportHost = (props: IGenerateReportHostProps) => {
    const { orderFormJson } = useResourceContext();
    const reportTemplate = orderFormJson && typeof orderFormJson === 'object'
        ? orderFormJson as Record<string, unknown>
        : null;

    if (!reportTemplate) {
        return <Loader />;
    }

    return (
        <GenerateReport
            uniqueName="feature-generate-report"
            selectedNode={props.selectedNode}
            reportTemplate={reportTemplate}
            addressFields={sampleOrderAddressFields}
            docType={sampleOrderDocType}
            dataset1={sampleOrderDataset1}
            dataset2={sampleOrderDataset2}
        />
    );
};

export { GenerateReportHost };
export default GenerateReportHost;
