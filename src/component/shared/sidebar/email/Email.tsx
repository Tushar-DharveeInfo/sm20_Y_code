import { useMemo, useEffect } from 'react';
import { ITreeNode } from '../../allinterface/tree/ITreeControl';
import type { IContactDoc } from '../../allinterface/IDatasets';
import { SendEmailToContact } from '../contactlist/SendEmailToContact';
import { useContacts } from '@n20a/libfsdb';
import { useSmDataContext } from '../../context/hooks/SmDataHooks';
import { useMainAppContext } from '../../context/hooks/MainAppHooks';
import { FnGetSourceDataset } from '../../allcommon/FnLoadSampleDatasets';
import { FnIsRootBusinessNode } from '../../allcommon/tree/FnIsRootBusinessNode';
import { Label } from '../../basic/label/Label';
import './Email.css';

export interface IEmailProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    selectedNode?: ITreeNode;
    contact?: IContactDoc;
    contacts?: IContactDoc[];
    handleShowUserMessage?: (messageText: string) => void;
    onClose?: () => void;
}

function resolveBidCid(selection: { bid?: string; cid?: string }, node?: ITreeNode): { bid: string; cid: string } {
    const bidFromSelection = String(selection.bid ?? '').trim();
    const cidFromSelection = String(selection.cid ?? '').trim();
    if (bidFromSelection && bidFromSelection.toLowerCase() !== 'root-businesses') {
        return { bid: bidFromSelection, cid: cidFromSelection };
    }

    if (!node || FnIsRootBusinessNode(node)) {
        return { bid: '', cid: '' };
    }

    const nodeType = String(node.NodeType ?? node.treetype ?? node.Type ?? '').trim().toLowerCase();

    if (nodeType === 'contact') {
        return {
            bid: String(node.bid ?? node.parentEntID ?? '').trim(),
            cid: String(node.cid ?? node.NodeEntID ?? node.key ?? '').trim(),
        };
    }

    return {
        bid: String(node.bid ?? node.NodeEntID ?? node.key ?? '').trim(),
        cid: String(node.cid ?? ''),
    };
}

const Email = (props: IEmailProps) => {
    const smDataContext = useSmDataContext();
    const mainAppContext = useMainAppContext();
    const userBid = String(mainAppContext?.authSession?.bid ?? '').trim();

    const effectiveNode = props.selectedNode ?? smDataContext.selectedNode;

    // Check if root node or no business/contact node is selected
    const isRootNode = useMemo(() => {
        if (!effectiveNode) return true;
        if (FnIsRootBusinessNode(effectiveNode)) return true;

        const nodeType = String(
            effectiveNode.NodeType ??
            effectiveNode.treetype ??
            effectiveNode.Type ??
            effectiveNode.NodeEntityname ??
            ''
        ).trim().toLowerCase();
        const key = String(effectiveNode.key ?? effectiveNode.NodeEntID ?? '').trim().toLowerCase();
        const name = String(effectiveNode.Name ?? effectiveNode.title ?? '').trim().toLowerCase();

        if (
            nodeType === 'root' ||
            nodeType === 'alldatacenters' ||
            key === 'root-businesses' ||
            key === 'root_businesses' ||
            key.startsWith('root') ||
            name.startsWith('businesses')
        ) {
            return true;
        }

        const hasBid = Boolean(effectiveNode.bid && String(effectiveNode.bid).toLowerCase() !== 'root-businesses');
        const hasCid = Boolean(effectiveNode.cid);
        const isBsOrContact =
            nodeType === 'business' ||
            nodeType === 'company' ||
            nodeType === 'contact' ||
            hasBid ||
            hasCid;

        return !isBsOrContact;
    }, [effectiveNode]);

    const isContactNode = useMemo(() => {
        if (!effectiveNode) return false;
        const nodeType = String(
            effectiveNode.NodeType ??
            effectiveNode.treetype ??
            effectiveNode.Type ??
            effectiveNode.NodeEntityname ??
            ''
        ).trim().toLowerCase();
        return nodeType === 'contact' || Boolean(effectiveNode.cid && effectiveNode.cid !== effectiveNode.bid && !nodeType.includes('business'));
    }, [effectiveNode]);

    // 1. Resolve bid & cid from selection / selectedNode
    const { bid: resolvedBid, cid: resolvedCid } = useMemo(() => {
        return resolveBidCid(smDataContext.selection, effectiveNode);
    }, [smDataContext.selection, effectiveNode]);

    const effectiveBid = resolvedBid || userBid;

    // 2. Fetch contacts for this business
    const { contacts: hookContacts, getContacts } = useContacts(effectiveBid);

    useEffect(() => {
        if (effectiveBid && !isRootNode) {
            void getContacts();
        }
    }, [effectiveBid, isRootNode, getContacts]);

    // 3. Fallback contacts from sample data / context dataset
    const sampleContacts = useMemo<IContactDoc[]>(() => {
        if (isRootNode) return [];
        const contextContacts = smDataContext.datasets?.contacts ?? [];
        if (contextContacts.length > 0 && effectiveBid) {
            const filtered = contextContacts.filter((c) => String(c.bid).toLowerCase() === effectiveBid.toLowerCase());
            if (filtered.length > 0) return filtered;
        }
        const list = (FnGetSourceDataset('contacts') || []) as IContactDoc[];
        if (effectiveBid) {
            const filtered = list.filter((c) => String(c.bid).toLowerCase() === effectiveBid.toLowerCase());
            return filtered.length > 0 ? filtered : list;
        }
        return list;
    }, [effectiveBid, isRootNode, smDataContext.datasets?.contacts]);

    // 4. Combine available contacts
    const availableContacts = useMemo<IContactDoc[]>(() => {
        if (isRootNode) return [];
        if (props.contacts && props.contacts.length > 0) {
            return props.contacts;
        }
        if (hookContacts && hookContacts.length > 0) {
            return hookContacts as unknown as IContactDoc[];
        }
        if (sampleContacts.length > 0) {
            return sampleContacts;
        }
        return [];
    }, [isRootNode, props.contacts, hookContacts, sampleContacts]);

    // 5. If selectedNode is a contact, build direct contact doc from it
    const directContactFromNode = useMemo<IContactDoc | null>(() => {
        if (!effectiveNode || !isContactNode) return null;
        const rec = effectiveNode as Record<string, unknown>;
        const cid = String(effectiveNode.cid ?? effectiveNode.NodeEntID ?? effectiveNode.key ?? '');
        const found = availableContacts.find((c) => c.cid === cid);
        if (found) return found;

        return {
            cid,
            bid: String(effectiveNode.bid ?? effectiveNode.parentEntID ?? effectiveBid),
            cname: String(effectiveNode.Name ?? rec.contact ?? rec.cname ?? 'Contact'),
            email: String(effectiveNode.email ?? rec.email ?? ''),
            phone: String(effectiveNode.phone ?? rec.phone ?? ''),
        };
    }, [effectiveNode, isContactNode, availableContacts, effectiveBid]);

    // 6. Determine the active contact to send to
    const activeContact = useMemo<IContactDoc | undefined>(() => {
        if (props.contact) return props.contact;
        if (directContactFromNode) return directContactFromNode;

        // If specific contact was selected in selection context (e.g. from contact card click)
        if (resolvedCid) {
            const found = availableContacts.find((c) => c.cid === resolvedCid);
            if (found) return found;
        }

        // For business node, pick primary contact or first contact
        if (availableContacts.length > 0) {
            const primary = availableContacts.find((c) => c.ctag === 'primary');
            return primary ?? availableContacts[0];
        }

        // Fallback from business node attributes
        if (effectiveNode && !isRootNode) {
            const rec = effectiveNode as Record<string, unknown>;
            return {
                cid: String(effectiveNode.cid ?? `bs_${effectiveBid}`),
                bid: effectiveBid,
                cname: String(effectiveNode.Name ?? effectiveNode.bname ?? rec.name ?? 'Business Contact'),
                email: String(effectiveNode.email ?? rec.email ?? ''),
                phone: String(effectiveNode.phone ?? rec.phone ?? ''),
            };
        }

        return undefined;
    }, [props.contact, directContactFromNode, resolvedCid, availableContacts, effectiveNode, effectiveBid, isRootNode]);

    // If root node is selected, display message
    if (isRootNode) {
        return (
            <div className="nz-sidebar-email-container">
                <div className="nz-sidebar-email-empty-message">
                    <Label
                        uniqueName="sidebar-email-select-business"
                        label="Select a business or company node"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="nz-sidebar-email-container">
            <div className='nz-sub-header'>Send Email</div>
            {/* Render the SendEmailToContact component inline (without isOpen) */}
            <SendEmailToContact
                uniqueName={props.uniqueName ?? 'sidebar-email'}
                headerText={props.headerText ?? 'Email'}
                contact={activeContact}
                contacts={availableContacts}
                handleShowUserMessage={props.handleShowUserMessage}
                onClose={props.onClose}
            />
        </div>
    );
};

export { Email };
export default Email;
