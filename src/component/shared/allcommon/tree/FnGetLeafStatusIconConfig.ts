import type { ComponentType } from "react";
import { Accepted, Open24x24, Received, Released } from "@n20a/libicon";

type ILeafStatusIconConfig = {
    Icon: ComponentType<{ size?: number | string; fill?: string; strokeWidth?: number }>;
    tooltip: string;
};

const LEAF_STATUS_ICON_MAP: Record<string, ILeafStatusIconConfig> = {
    Released: { Icon: Released, tooltip: "Released" },
    Accepted: { Icon: Accepted, tooltip: "Accepted" },
    Received: { Icon: Received, tooltip: "Received" },
    Open: { Icon: Open24x24, tooltip: "Open" },
};

const FnGetLeafStatus = (treeNode: {
    isLeaf?: boolean;
    Status?: string;
    NodeState?: string | null;
}): string | undefined => {
    if (!treeNode.isLeaf) return undefined;

    const status = treeNode.Status ?? treeNode.NodeState ?? undefined;

    return typeof status === "string" && status.trim() ? status.trim() : undefined;
};

const FnGetLeafStatusIconConfig = (
    treeNode: Parameters<typeof FnGetLeafStatus>[0]
): ILeafStatusIconConfig | null => {
    const status = FnGetLeafStatus(treeNode);
    if (!status) return null;
    if (LEAF_STATUS_ICON_MAP[status]) {
        return LEAF_STATUS_ICON_MAP[status];
    }
    const matchedKey = Object.keys(LEAF_STATUS_ICON_MAP).find(
        (key) => key.toLowerCase() === status.toLowerCase()
    );
    return matchedKey ? LEAF_STATUS_ICON_MAP[matchedKey] : null;
};

export { FnGetLeafStatus, FnGetLeafStatusIconConfig, LEAF_STATUS_ICON_MAP };
export type { ILeafStatusIconConfig };
