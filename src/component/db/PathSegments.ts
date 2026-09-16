
interface IBusinessPathSegmentProfile {
  collectionName: string;
  bid?: string;
  cid?: string;
  noteid?: string;
  ticketid?: string;
  activityid?: string;
  orderid?: string;
  subsid?: string;
}

const BusinessPathSegment = (requiredBusinessPath: IBusinessPathSegmentProfile) => {
    switch (requiredBusinessPath.collectionName) {
        case 'businesses':
            return { pathSegments: ['businesses', requiredBusinessPath.bid] };
        case 'contacts':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'contacts', requiredBusinessPath.cid] };
        case 'notes':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'notes', requiredBusinessPath.noteid] };
        case 'tickets':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'tickets', requiredBusinessPath.ticketid] };
        case 'ticketnotes':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'tickets', requiredBusinessPath.ticketid, 'ticketnotes']};
        case 'activities':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'activities', requiredBusinessPath.activityid] };
        case 'orders':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'orders', requiredBusinessPath.orderid] };
        case 'carts':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'orders', requiredBusinessPath.orderid, 'carts'] };
        case 'supporthoursused':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'orders', requiredBusinessPath.orderid, 'supporthoursused'] };
        case 'subs':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'subs', requiredBusinessPath.subsid] };
        case 'downloads':
            return { pathSegments: ['businesses', requiredBusinessPath.bid, 'subs', requiredBusinessPath.subsid, 'downloads']};
        case 'todo':
            return { pathSegments: ['todo']};
        case 'prospect':
            return { pathSegments: ['prospect', requiredBusinessPath.cid] };
        default:
            throw new Error(`Unknown collection name: ${requiredBusinessPath.collectionName}`);
    }
};

interface IContactPathSegmentProfile {
  collectionName: string;
  bid?: string;
  cid?: string;
  noteid?: string;
  ticketid?: string;
  activityid?: string;
  orderid?: string;
  subsid?: string;
}
const ContactPathSegment = (requiredContactPath: IContactPathSegmentProfile) => {
    switch (requiredContactPath.collectionName) {
        case 'contacts':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'contacts', requiredContactPath.cid] };
        case 'notes':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'notes', requiredContactPath.noteid] };
        case 'tickets':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'tickets', requiredContactPath.ticketid] };
        case 'ticketnotes':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'tickets', requiredContactPath.ticketid, 'ticketnotes']};
        case 'activities':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'activities', requiredContactPath.activityid] };
        case 'orders':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'orders', requiredContactPath.orderid] };
        case 'carts':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'orders', requiredContactPath.orderid, 'carts'] };
        case 'supporthoursused':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'orders', requiredContactPath.orderid, 'supporthoursused'] };
        case 'subs':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'subs', requiredContactPath.subsid] };
        case 'downloads':
            return { pathSegments: ['businesses', requiredContactPath.bid, 'subs', requiredContactPath.subsid, 'downloads']};
        case 'todo':
            return { pathSegments: ['todo']};
        case 'prospect':
            return { pathSegments: ['prospect', requiredContactPath.cid] };
        default:
            throw new Error(`Unknown collection name: ${requiredContactPath.collectionName}`);
    }
};
export { BusinessPathSegment, ContactPathSegment };
