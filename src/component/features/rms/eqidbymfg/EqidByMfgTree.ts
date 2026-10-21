import type { ITreeNode } from '../../../shared/allinterface/tree/ITreeControl';
import type { IEqidDoc, IMfgRecord } from '../../../shared/context/allinterface/IRms';
import Styles from '../../../shared/sidebar/rms/rmscollection/Style.json';
import { getFullTicketsCached } from '../../tickets/allcommon/TicketsDataStore';

export function normalizeKey(key: string): string {
    return (key || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
}

export function mfgNodeKey(mfgName: string): string {
    return `mfg__${normalizeKey(mfgName)}`;
}

export function prodlineNodeKey(mfgName: string, prodline: string): string {
    return `prodline__${normalizeKey(mfgName)}__${encodeURIComponent(prodline.trim())}`;
}

export function eqtypeNodeKey(mfgName: string, prodline: string, eqtype: string): string {
    return `eqtype__${normalizeKey(mfgName)}__${encodeURIComponent(prodline.trim())}__${encodeURIComponent(eqtype.trim())}`;
}

export function eqidNodeKey(mfgName: string, prodline: string, eqtype: string, eqid: string): string {
    return `eqid__${normalizeKey(mfgName)}__${encodeURIComponent(prodline.trim())}__${encodeURIComponent(eqtype.trim())}__${encodeURIComponent(eqid.trim())}`;
}

export function shapestyleNodeKey(eqid: string, styleId: string): string {
    return `shapestyle__${encodeURIComponent(eqid.trim())}__${encodeURIComponent(styleId.trim())}`;
}

export interface IShapeStyleItem {
    id: string;
    name: string;
    description: string;
    raw?: unknown;
}

/**
 * Extracts associated ShapeStyles from an EQID record.
 * Falls back to standard ShapeStyles if none are explicitly declared.
 */
export function extractShapeStylesForEqid(eqidRecord: any, eqid: string): IShapeStyleItem[] {
    const rawList =
        eqidRecord?.shapeStyles ??
        eqidRecord?.ShapeStyles ??
        eqidRecord?.shapeid ??
        eqidRecord?.ShapeID ??
        eqidRecord?.shapes ??
        eqidRecord?.shapestyles;

    if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((item, idx) => {
            if (typeof item === 'string') {
                const clean = item.trim();
                const matchedStyle = Styles.find(
                    (s) => clean.includes(s.StyleAcronym) || clean === s.Description || clean === s.Style
                );
                const desc = matchedStyle?.Description || clean;
                const orientation = clean.includes(':V') ? ' (Vertical)' : clean.includes(':H') ? ' (Horizontal)' : '';
                return {
                    id: clean,
                    name: `${desc}${orientation}`,
                    description: desc,
                    raw: item,
                };
            }
            if (item && typeof item === 'object') {
                const id = String(item.id || item.ShapeID || item.RecID || item.Style || `style_${idx + 1}`);
                const desc = String(item.Description || item.description || item.Name || item.name || id);
                return {
                    id,
                    name: desc,
                    description: desc,
                    raw: item,
                };
            }
            return {
                id: `style_${idx + 1}`,
                name: `ShapeStyle ${idx + 1}`,
                description: `ShapeStyle ${idx + 1}`,
                raw: item,
            };
        });
    }

    // Default 3 standard styles matching requirement diagram:
    // ShapeStyle 1, ShapeStyle 2, ShapeStyle 3
    const defaultStyles = Styles.slice(0, 3);
    return defaultStyles.map((s, idx) => ({
        id: `${eqid}${s.StyleAcronym}:H`,
        name: `ShapeStyle ${idx + 1} (${s.Description})`,
        description: s.Description,
        raw: s,
    }));
}

/**
 * Ensures we have a non-empty list of EQID records.
 * Falls back to synthesizing from tickets if no EQID documents exist yet.
 */
function ensureEqidRecords(rawRecords: IEqidDoc[]): IEqidDoc[] {
    if (Array.isArray(rawRecords) && rawRecords.length > 0) {
        return rawRecords;
    }

    // Fallback: extract tickets from cache
    const tickets = getFullTicketsCached();
    if (Array.isArray(tickets) && tickets.length > 0) {
        return tickets.map((t, idx) => {
            const mfg = String(t.mfg || 'Generic Vendor').trim();
            const prodline = String(t.prodline || 'Standard Series').trim();
            const eqtype = String(t.eqtype || 'Network Node').trim();
            const prodno = String(t.prodno || `PRD-${100 + idx}`).trim();
            const eqid = String((t as any).eqid || (t as any).EQID || `0${mfg.substring(0, 3).toUpperCase()}${String(idx + 1).padStart(3, '0')}`);

            return {
                ticketid: t.ticketid,
                bid: t.bid,
                cid: t.cid,
                EQID: eqid,
                eqid: eqid,
                Manufacturer: mfg,
                mfg: mfg,
                ProdLine: prodline,
                prodline: prodline,
                EqType: eqtype,
                eqtype: eqtype,
                ProdNo: prodno,
                prodno: prodno,
                Acronym: mfg.substring(0, 4).toUpperCase(),
                Description: t.moreinfo || `${mfg} ${prodline} ${eqtype}`,
                lastupdated: t.lastupdated,
            } as unknown as IEqidDoc;
        });
    }

    return [];
}

export const ROOT_KEY = 'root-manufacturers';

/**
 * Builds the hierarchical tree structure:
 * Manufacturers (Root)
 *  └── Manufacturer (Mfg)
 *       └── Product Line (ProdLine)
 *            └── Equipment Type (EqType)
 *                 └── EQID (nodeType: "EQID")
 *                      ├── ShapeStyle 1 (nodeType: "ShapeStyle")
 *                      ├── ShapeStyle 2 (nodeType: "ShapeStyle")
 *                      └── ShapeStyle 3 (nodeType: "ShapeStyle")
 */
export function buildEqidByMfgTree(
    rawEqidRecords: IEqidDoc[],
    mfgRecords?: IMfgRecord[]
): ITreeNode[] {
    const eqidRecords = ensureEqidRecords(rawEqidRecords);

    // Map: mfgName -> Map<prodline, Map<eqtype, IEqidDoc[]>>
    const mfgMap = new Map<string, Map<string, Map<string, IEqidDoc[]>>>();
    const mfgRecordLookup = new Map<string, IMfgRecord>();

    if (mfgRecords && mfgRecords.length > 0) {
        for (const m of mfgRecords) {
            if (m.mfgname) mfgRecordLookup.set(m.mfgname.trim().toLowerCase(), m);
            if (m.mfgkey) mfgRecordLookup.set(m.mfgkey.trim().toLowerCase(), m);
        }
    }

    for (let i = 0; i < eqidRecords.length; i++) {
        const record = eqidRecords[i];
        const rawMfg = String(
            record.Manufacturer || (record as any).mfg || (record as any).mfgname || (record as any).Mfg || (record as any).Acronym || 'Generic'
        ).trim();
        const mfg = rawMfg || 'Generic';

        const rawProd = String(
            record.ProdLine || (record as any).prodline || (record as any).ProductLine || (record as any).productline || 'General'
        ).trim();
        const prodline = rawProd || 'General';

        const rawEqType = String(
            record.EqType || (record as any).eqtype || (record as any).EquipmentType || (record as any).equipmenttype || (record as any).mfgeqtype || 'General'
        ).trim();
        const eqtype = rawEqType || 'General';

        const rawEqid = String(
            record.EQID || (record as any).eqid || (record as any).id || (record as any).ticketid || `EQID_${i + 1}`
        ).trim();
        const eqid = rawEqid || `EQID_${i + 1}`;

        if (!mfgMap.has(mfg)) {
            mfgMap.set(mfg, new Map());
        }
        const prodMap = mfgMap.get(mfg)!;

        if (!prodMap.has(prodline)) {
            prodMap.set(prodline, new Map());
        }
        const eqtypeMap = prodMap.get(prodline)!;

        if (!eqtypeMap.has(eqtype)) {
            eqtypeMap.set(eqtype, []);
        }
        const eqidList = eqtypeMap.get(eqtype)!;

        // Deduplicate EQIDs within the same EqType
        const existingIdx = eqidList.findIndex(
            (e) => String(e.EQID || (e as any).eqid || '').trim().toLowerCase() === eqid.toLowerCase()
        );
        if (existingIdx >= 0) {
            eqidList[existingIdx] = { ...eqidList[existingIdx], ...record };
        } else {
            eqidList.push({ ...record, EQID: eqid, eqid: eqid });
        }
    }

    // Build the hierarchical tree nodes
    const sortedMfgNames = Array.from(mfgMap.keys()).sort((a, b) => a.localeCompare(b));
    const mfgNodes: ITreeNode[] = [];

    for (const mfg of sortedMfgNames) {
        const mfgKey = mfgNodeKey(mfg);
        const prodMap = mfgMap.get(mfg)!;
        const sortedProdlines = Array.from(prodMap.keys()).sort((a, b) => a.localeCompare(b));
        const prodLineNodes: ITreeNode[] = [];

        let totalEqtypesForMfg = 0;
        let totalEqidsForMfg = 0;

        for (const prodline of sortedProdlines) {
            const prodLineKey = prodlineNodeKey(mfg, prodline);
            const eqtypeMap = prodMap.get(prodline)!;
            const sortedEqtypes = Array.from(eqtypeMap.keys()).sort((a, b) => a.localeCompare(b));
            const eqTypeNodes: ITreeNode[] = [];

            totalEqtypesForMfg += sortedEqtypes.length;
            let totalEqidsForProdline = 0;

            for (const eqtype of sortedEqtypes) {
                const eqTypeKey = eqtypeNodeKey(mfg, prodline, eqtype);
                const eqidList = eqtypeMap.get(eqtype)!;
                const sortedEqids = [...eqidList].sort((a, b) =>
                    String(a.EQID || (a as any).eqid || '').localeCompare(String(b.EQID || (b as any).eqid || ''))
                );
                const eqidNodes: ITreeNode[] = [];

                totalEqidsForProdline += sortedEqids.length;
                totalEqidsForMfg += sortedEqids.length;

                for (const eqidRecord of sortedEqids) {
                    const eqid = String(eqidRecord.EQID || (eqidRecord as any).eqid || '').trim();
                    const eKey = eqidNodeKey(mfg, prodline, eqtype, eqid);

                    const prodno = String(eqidRecord.prodno || eqidRecord.ProdNo || '').trim();
                    const ticketid = String(eqidRecord.ticketid || eqid).trim();

                    // Under each EQID node, display its associated ShapeStyles with nodeType: "ShapeStyle"
                    const shapeStyles = extractShapeStylesForEqid(eqidRecord, eqid);
                    const shapeStyleNodes: ITreeNode[] = shapeStyles.map((style) => {
                        const styleKey = shapestyleNodeKey(eqid, style.id);
                        return {
                            key: styleKey,
                            title: style.name,
                            Name: style.name,
                            TableLabel: style.name,
                            NodeType: 'ShapeStyle',
                            treetype: 'ShapeStyle',
                            nodeType: 'ShapeStyle',
                            NodeEntityname: 'ShapeStyle',
                            parentEntID: eKey,
                            isLeaf: true,
                            HasChildren: 0,
                            children: [],
                            eqid: eqid,
                            EQID: eqid,
                            ticketid: ticketid,
                            prodno: prodno,
                            mfgName: mfg,
                            prodline: prodline,
                            eqtype: eqtype,
                            shapeId: style.id,
                            ShapeID: style.id,
                            styleId: style.id,
                            shapeStyleData: {
                                eqid,
                                styleName: style.name,
                                styleId: style.id,
                                description: style.description,
                                raw: style.raw,
                            },
                        };
                    });

                    // Set nodeType: "EQID" for EQID nodes
                    const eqidTitle = prodno ? `${eqid} (${prodno})` : eqid;
                    eqidNodes.push({
                        key: eKey,
                        title: eqidTitle,
                        Name: eqid,
                        TableLabel: eqid,
                        NodeType: 'EQID',
                        treetype: 'EQID',
                        nodeType: 'EQID',
                        NodeEntityname: 'EQID',
                        parentEntID: eqTypeKey,
                        eqid: eqid,
                        EQID: eqid,
                        ticketid: ticketid,
                        prodno: prodno,
                        mfg: mfg,
                        Manufacturer: mfg,
                        prodline: prodline,
                        ProdLine: prodline,
                        eqtype: eqtype,
                        EqType: eqtype,
                        eqidRecord: eqidRecord,
                        mfgName: mfg,
                        isLeaf: shapeStyleNodes.length === 0,
                        HasChildren: shapeStyleNodes.length,
                        children: shapeStyleNodes,
                        ...eqidRecord,
                    });
                }

                eqTypeNodes.push({
                    key: eqTypeKey,
                    title: `${eqtype} (${eqidNodes.length})`,
                    Name: eqtype,
                    TableLabel: eqtype,
                    NodeType: 'EqType',
                    treetype: 'EqType',
                    nodeType: 'EqType',
                    NodeEntityname: 'EqType',
                    parentEntID: prodLineKey,
                    mfgName: mfg,
                    prodline: prodline,
                    eqtype: eqtype,
                    totalEqids: eqidNodes.length,
                    isLeaf: eqidNodes.length === 0,
                    HasChildren: eqidNodes.length,
                    children: eqidNodes,
                });
            }

            prodLineNodes.push({
                key: prodLineKey,
                title: `${prodline} (${eqTypeNodes.length})`,
                Name: prodline,
                TableLabel: prodline,
                NodeType: 'ProdLine',
                treetype: 'ProdLine',
                nodeType: 'ProdLine',
                NodeEntityname: 'ProdLine',
                parentEntID: mfgKey,
                mfgName: mfg,
                prodline: prodline,
                totalEqtypes: eqTypeNodes.length,
                totalEqids: totalEqidsForProdline,
                isLeaf: eqTypeNodes.length === 0,
                HasChildren: eqTypeNodes.length,
                children: eqTypeNodes,
            });
        }

        const matchedRecord = mfgRecordLookup.get(mfg.toLowerCase());
        const acronym = matchedRecord?.mfgkey || mfg.substring(0, 4).toUpperCase();

        mfgNodes.push({
            key: mfgKey,
            title: `${mfg} (${prodLineNodes.length})`,
            Name: mfg,
            TableLabel: mfg,
            NodeType: 'Mfg',
            treetype: 'Mfg',
            nodeType: 'Mfg',
            NodeEntityname: 'Mfg',
            parentEntID: ROOT_KEY,
            mfgName: mfg,
            acronym: acronym,
            mfgRecord: matchedRecord,
            totalProdlines: prodLineNodes.length,
            totalEqtypes: totalEqtypesForMfg,
            totalEqids: totalEqidsForMfg,
            isLeaf: prodLineNodes.length === 0,
            HasChildren: prodLineNodes.length,
            children: prodLineNodes,
        });
    }

    const rootNode: ITreeNode = {
        key: ROOT_KEY,
        title: `Manufacturers (${mfgNodes.length})`,
        Name: `Manufacturers (${mfgNodes.length})`,
        TableLabel: `Manufacturers (${mfgNodes.length})`,
        NodeType: 'Root',
        treetype: 'Root',
        nodeType: 'Root',
        NodeEntityname: 'Root',
        NodeEntID: ROOT_KEY,
        parentEntID: null,
        isLeaf: mfgNodes.length === 0,
        HasChildren: mfgNodes.length,
        children: mfgNodes,
    };

    return [rootNode];
}
