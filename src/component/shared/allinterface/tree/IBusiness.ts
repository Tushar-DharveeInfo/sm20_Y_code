interface IBusiness {
    bid: string;
    btype: string;
    status: string;
    verified: boolean;
    salesExec: string;
    bname: string;
    country: string;
    state: string;
    daysNoticePeriod: number;
    mmFinYear: number;
    relatedBids: string;
    dateCreated: string;
    dateUpdated: string;
    /*Product lines for Client menu auto-filters (NetZoom, VisioStencils, SSI). */
    tag?: string;
}

interface IBusinessesResponse {
    businesses: IBusiness[];
}

export type { IBusiness, IBusinessesResponse };
