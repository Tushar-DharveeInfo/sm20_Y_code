import { useState, useMemo, useEffect } from "react";
import { Cart24x24 } from "@n20a/libicon";
import { EditTextXControl } from "@n20a/libform";
import { FnGetCssVariable } from "../../../appcontainer/allcommon/FnGetCssVariable";
import { handleNestedZoneContainerKeyDown } from "../../allcommon/basic/FnHandleContainerKeyDown";
import { Label } from "../../basic/label/Label";
import { CardLayout, ICardLayoutField } from "../../cardlayout/CardLayout";
import type { IOrderDoc } from "../../allinterface/IDatasets";
import { useSmDataContext } from "../../context/hooks/SmDataHooks";
import { useOrders } from "@n20a/libfsdb";
import { ITreeNode } from "../../allinterface/tree/ITreeControl";
import "./OrderList.css";

interface IOrderList {
    uniqueName: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    featureId?: string;
    handleShowUserMessage?: (messageText: string) => void;
}

function isBusinessExplorerNode(node?: ITreeNode): boolean {
    const nodeType = node?.NodeType?.toLowerCase() ?? "";
    return nodeType === "business" || nodeType === "contact";
}

function resolveBid(selection: { bid?: string }, node?: ITreeNode): string {
    const bidFromSelection = String(selection.bid ?? "").trim();
    if (bidFromSelection) {
        return bidFromSelection;
    }
    if (!isBusinessExplorerNode(node)) {
        return "";
    }
    return String(node?.bid ?? node?.parentEntID ?? node?.NodeEntID ?? node?.key ?? "").trim();
}

const buildOrderCardFields = (order: IOrderDoc): ICardLayoutField[] => {
    const fields: ICardLayoutField[] = [
        {
            Name: "Order ID",
            Value: order.orderid || order.title || "—",
            Header: 1,
        },
    ];

    if (order.title && order.title !== order.orderid) {
        fields.push({
            Name: "Title",
            Value: order.title,
        });
    }

    if (order.invoiceid) {
        fields.push({
            Name: "Invoice ID",
            Value: order.invoiceid,
            Row: "space-between",
        });
    }

    if (order.amount !== undefined && order.amount !== null) {
        const formattedAmount = typeof order.amount === "number"
            ? `$${order.amount.toLocaleString()}`
            : String(order.amount);
        fields.push({
            Name: "Amount",
            Value: formattedAmount,
            Group: "amount-status",
        });
    }

    if (order.status) {
        fields.push({
            Name: "Status",
            Value: order.status,
            Group: "amount-status",
        });
    }

    if (order.datecreated) {
        const formattedDate = order.datecreated.length >= 10
            ? order.datecreated.slice(0, 10)
            : order.datecreated;
        fields.push({
            Name: "Date Created",
            Value: formattedDate,
        });
    }

    if (order.expirydate) {
        const formattedExpiry = order.expirydate.length >= 10
            ? order.expirydate.slice(0, 10)
            : order.expirydate;
        fields.push({
            Name: "Expiry Date",
            Value: formattedExpiry,
        });
    }

    return fields;
};

const OrderList = (props: IOrderList) => {
    const smDataContext = useSmDataContext();
    const [selectedOrderId, setSelectedOrderId] = useState<string>("");
    const [filterKeyword, setFilterKeyword] = useState<string>("");

    const bid = resolveBid(
        smDataContext.selection,
        smDataContext.selectedNode ?? (isBusinessExplorerNode(props.selectedNode) ? props.selectedNode : undefined)
    );

    const { loading, error, getOrders, orders } = useOrders(bid);

    useEffect(() => {
        if (bid) {
            void getOrders();
        }
    }, [bid, getOrders]);

    const businessOrders = useMemo<IOrderDoc[]>(() => {
        const apiOrders = Array.isArray(orders) ? (orders as unknown as IOrderDoc[]) : [];
        const contextOrders = (smDataContext.datasets?.orders ?? []).filter(
            (o) => String(o.bid).trim().toLowerCase() === bid.toLowerCase()
        );

        const combined = [...apiOrders, ...contextOrders];
        const seenOrderIds = new Set<string>();
        const uniqueOrders: IOrderDoc[] = [];

        for (const o of combined) {
            const oid = String(o.orderid || (o as any).id || (o as any).EntID || '').trim().toLowerCase();
            if (oid) {
                if (!seenOrderIds.has(oid)) {
                    seenOrderIds.add(oid);
                    uniqueOrders.push(o);
                }
            } else {
                uniqueOrders.push(o);
            }
        }
        return uniqueOrders;
    }, [bid, orders, smDataContext.datasets?.orders]);

    useEffect(() => {
        if (businessOrders.length > 0) {
            setSelectedOrderId((prev) => {
                const exists = businessOrders.some((o) => o.orderid === prev);
                return exists ? prev : (businessOrders[0].orderid ?? '');
            });
        }
    }, [businessOrders]);

    const filteredOrders = useMemo(() => {
        const query = filterKeyword.trim().toLowerCase();
        if (!query) {
            return businessOrders;
        }

        return businessOrders.filter((item) => {
            const haystack = [
                item.orderid,
                item.title,
                item.invoiceid,
                item.status,
                String(item.amount ?? ""),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [businessOrders, filterKeyword]);

    return (
        <div
            className="nz-sidebar-order-list-container"
            tabIndex={1}
            onKeyDown={handleNestedZoneContainerKeyDown}
            key={props.uniqueName}
        >
            <div className="nz-sub-header">
                <Label
                    uniqueName={`${props.uniqueName}-order-header`}
                    label={`${props.headerText ?? "Orders"}${businessOrders.length > 0 ? ` (${filteredOrders.length})` : ""}`}
                />
            </div>

            {businessOrders.length > 0 && (
                <div className="nz-sidebar-order-list-search">
                    <EditTextXControl
                        name={`${props.uniqueName}-filter`}
                        label=""
                        placeholder="Filter orders..."
                        value={filterKeyword}
                        onChange={(val) => setFilterKeyword(String(val ?? ""))}
                    />
                </div>
            )}

            <div className="nz-sidebar-order-list-content">
                {loading ? (
                    <div className="nz-sidebar-order-list-empty">
                        Loading orders...
                    </div>
                ) : error ? (
                    <div className="nz-sidebar-order-list-empty">
                        {error}
                    </div>
                ) : businessOrders.length === 0 ? (
                    <div className="nz-sidebar-order-list-empty">
                        {bid
                            ? "No orders for selected business"
                            : "Select a business to view orders"}
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="nz-sidebar-order-list-empty">
                        No orders matching filter
                    </div>
                ) : (
                    filteredOrders.map((order, index) => (
                        <CardLayout
                            key={order.orderid || `${props.uniqueName}-card-${index}`}
                            uniqueName={`${props.uniqueName}-order-card-${order.orderid}`}
                            className="nz-order-card"
                            data={order}
                            fields={buildOrderCardFields(order)}
                            isSelected={selectedOrderId === order.orderid}
                            hideRightMouseMenu={true}
                            onClick={() => setSelectedOrderId(order.orderid ?? '')}
                            ContentImage={{
                                uniqueName: `${props.uniqueName}-order-icon-${order.orderid}`,
                                source: (
                                    <Cart24x24
                                        size={FnGetCssVariable("--image-size-2")}
                                        fill="none"
                                        strokeWidth={1}
                                    />
                                ),
                                w: "var(--image-size-2)",
                                h: "var(--image-size-2)",
                                type: "svg",
                                tooltip: order.title || order.orderid || "Order",
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export { OrderList };
