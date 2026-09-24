import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@mui/material';
import { Close24x24, User24x24, Delegate24x24, Filter24x24 } from '@n20a/libicon';
import { EditTextXControl } from '@n20a/libform';
import { FnGetCssVariable } from '../../../appcontainer/allcommon/FnGetCssVariable';
import { useMainAppContext } from '../../../shared/context/hooks/MainAppHooks';
import { CardLayout, ICardLayoutField } from '../../../shared/cardlayout/CardLayout';
import usersData from '../../../../smsampledata/datasets/users.json';
import businessesData from '../../../../smsampledata/datasets/businesses.json';
import './Impersonate.css';
import { FnGetLoggedInStatusMessage } from '../../../appcontainer/allcommon/FnGetLoggedInStatusMessage';
import type { IUserAuthSession } from '../../../shared/context/allinterface/IMainApp';

interface IUserRecord {
    bid: string;
    cid: string;
    email: string;
}

interface IAppqaImpersonateProps {
    uniqueName?: string;
    featureId?: string;
    headerText?: string;
    handleShowUserMessage?: (messageText: string, container?: HTMLDivElement) => void;
}

const formatNameFromEmail = (email: string): string => {
    if (!email) return 'User';
    const namePart = email.split('@')[0] ?? '';
    return (
        namePart
            .split(/[._-]/)
            .filter(Boolean)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join(' ') || 'User'
    );
};

const Impersonate: React.FC<IAppqaImpersonateProps> = (props) => {
    const [isOpen, setIsOpen] = useState(true);
    const [filterText, setFilterText] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const navigate = useNavigate();
    const mainAppContext = useMainAppContext();

    // Map business IDs to business names from businesses.json
    const businessMap = useMemo(() => {
        const map = new Map<string, string>();
        if (Array.isArray(businessesData)) {
            businessesData.forEach((b: Record<string, unknown>) => {
                if (b?.bid && b?.bname) {
                    map.set(String(b.bid).toLowerCase(), String(b.bname));
                }
            });
        }
        return map;
    }, []);

    // Extract logged-in user identifiers to filter out
    const authSession = mainAppContext.authSession;
    const loginEmail = String(authSession?.email ?? authSession?.username ?? '').toLowerCase().trim();
    const loginBid = String(authSession?.bid ?? '').toLowerCase().trim();
    const loginCid = String(authSession?.cid ?? '').toLowerCase().trim();



    const effectiveEmail = loginEmail
    const effectiveBid = loginBid
    const effectiveCid = loginCid

    // Filter out the logged-in user from users.json
    const { filteredUsers, excludedCount } = useMemo(() => {
        let count = 0;
        const list = (usersData as IUserRecord[]).filter((user) => {
            const uEmail = String(user.email ?? '').toLowerCase().trim();
            const uBid = String(user.bid ?? '').toLowerCase().trim();
            const uCid = String(user.cid ?? '').toLowerCase().trim();

            if (effectiveEmail && uEmail === effectiveEmail) {
                count++;
                return false;
            }
            if (effectiveBid && effectiveCid && uBid === effectiveBid && uCid === effectiveCid) {
                count++;
                return false;
            }
            return true;
        });
        return { filteredUsers: list, excludedCount: count };
    }, [effectiveEmail, effectiveBid, effectiveCid]);

    // Apply search/filter text from LibForm EditTextXControl
    const displayedUsers = useMemo(() => {
        const query = filterText.toLowerCase().trim();
        if (!query) return filteredUsers;
        return filteredUsers.filter((user) => {
            const name = formatNameFromEmail(user.email).toLowerCase();
            const email = String(user.email ?? '').toLowerCase();
            const bid = String(user.bid ?? '').toLowerCase();
            const cid = String(user.cid ?? '').toLowerCase();
            const company = (businessMap.get(bid) ?? '').toLowerCase();
            return (
                name.includes(query) ||
                email.includes(query) ||
                bid.includes(query) ||
                cid.includes(query) ||
                company.includes(query)
            );
        });
    }, [filteredUsers, filterText, businessMap]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate('/');
        }
    }, [navigate]);

    const handleImpersonateUser = (user: IUserRecord) => {
        const displayName = formatNameFromEmail(user.email);
        const ImpersonatedUser = formatNameFromEmail(user.email);

        // Build impersonated authSession by spreading existing session and overriding user-specific fields
        const impersonatedSession: IUserAuthSession = {
            ...authSession,
            id: authSession?.id ?? '',
            username: authSession?.username ?? '',
            email: authSession?.email ?? '',
            displayName: authSession?.displayName ?? "",
            phoneNumber: authSession?.phoneNumber ?? null,
            authType: authSession?.authType ?? '',
            tenantNickname: authSession?.tenantNickname ?? null,
            bucketName: authSession?.bucketName ?? 'n20-bucket-01',
            baseFolder: authSession?.baseFolder ?? 'sm',
            ImpersonatedUser: ImpersonatedUser,
            ImpersonatedEmail: user.email,
            bid: user.bid,
            cid: user.cid,
            isAuthenticated: true,
        };

        // Update authSession — triggers app-wide re-render
        mainAppContext.setAuthSession(impersonatedSession);

        props.handleShowUserMessage?.(
            `Impersonating ${displayName} (${user.email})`
        );

        // Close the dialog and navigate back
        setIsOpen(false);
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate('/');
        }
    };

    const buildUserCardFields = (
        user: IUserRecord,
        displayName: string,
        companyName?: string
    ): ICardLayoutField[] => {
        return [
            {
                Name: '',
                Value: displayName,
                Header: 1,
            },
            {
                Name: '',
                Value: '',
                Header: 2,
                ValueContent: (
                    <button
                        type="button"
                        className="nz-impersonate-card-btn"
                        title={`Impersonate as ${displayName}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleImpersonateUser(user);
                        }}
                    >
                        <Delegate24x24 size="14px" fill="none" strokeWidth={1} />
                        <span>Impersonate</span>
                    </button>
                ),
            },
            {
                Name: 'Email',
                Value: user.email,
                Row: 'inline',
            },
            {
                Name: 'BID',
                Value: companyName ? `${user.bid} (${companyName})` : user.bid,
                Row: 'inline',
            },
            {
                Name: 'CID',
                Value: user.cid,
                Row: 'inline',
            },
        ];
    };

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            className="nz-impersonate-dialog"
            maxWidth="md"
            fullWidth
            aria-labelledby="impersonate-dialog-title"
        >
            <div className="nz-impersonate-container">
                {/* Header */}
                <div className="nz-impersonate-header">
                    <div className="nz-impersonate-header-left">
                        <div className="nz-impersonate-header-icon">
                            <Delegate24x24
                                size={FnGetCssVariable('--image-size-2', '20px')}
                                fill="none"
                                strokeWidth={1}
                            />
                        </div>
                        <h2 id="impersonate-dialog-title" className="nz-impersonate-header-title">
                            {props.headerText || 'Impersonate User'}
                        </h2>
                        <span className="nz-impersonate-header-badge">
                            {displayedUsers.length} {displayedUsers.length === 1 ? 'user' : 'users'}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="nz-impersonate-close-btn"
                        onClick={handleClose}
                        title="Close"
                        aria-label="Close"
                    >
                        <Close24x24
                            size={FnGetCssVariable('--image-size-2', '20px')}
                            fill="none"
                            strokeWidth={1}
                        />
                    </button>
                </div>

                {/* LibForm Search / Filter Bar (node style with filter icon) */}
                <div className="nz-impersonate-search-bar">
                    <div className="nz-impersonate-search-wrapper">
                        <div className="nz-searchControl">
                            <div className="nz-filter-icon" title="Filter users">
                                <Filter24x24
                                    size={FnGetCssVariable('--image-size-2', '20px')}
                                    fill="none"
                                    strokeWidth={1}
                                />
                            </div>
                            <div className="nz-search-control">
                                <EditTextXControl
                                    name="impersonate-user-filter"
                                    label=""
                                    placeholder="Filter users..."
                                    value={filterText}
                                    onChange={(value) => setFilterText(String(value ?? ''))}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Body - Grid of User Cards using CardLayout */}
                <div className="nz-impersonate-body">
                    {displayedUsers.length === 0 ? (
                        <div className="nz-impersonate-empty">
                            <User24x24 size="36px" fill="none" strokeWidth={1} />
                            <span>
                                {filterText
                                    ? `No users matching "${filterText}"`
                                    : 'No users available to impersonate'}
                            </span>
                        </div>
                    ) : (
                        <div
                            className="nz-impersonate-grid"
                            data-card-layout-list
                            role="listbox"
                            aria-label="Available users to impersonate"
                        >
                            {displayedUsers.map((user, index) => {
                                const displayName = formatNameFromEmail(user.email);
                                const companyName = businessMap.get(user.bid.toLowerCase());
                                const userKey = `${user.bid}-${user.cid}`;

                                return (
                                    <CardLayout
                                        key={userKey || index}
                                        uniqueName={`${props.uniqueName ?? 'app-qa-impersonate'}-card-${userKey}`}
                                        className="nz-impersonate-card"
                                        data={user}
                                        fields={buildUserCardFields(user, displayName, companyName)}
                                        isSelected={selectedUserId === userKey}
                                        hideRightMouseMenu={true}
                                        onClick={(_event, _data) => {
                                            setSelectedUserId(userKey);
                                        }}
                                        ContentImage={{
                                            uniqueName: `user-avatar-${userKey}`,
                                            source: (
                                                <User24x24
                                                    size={FnGetCssVariable('--image-size-2', '20px')}
                                                    fill="none"
                                                    strokeWidth={1}
                                                />
                                            ),
                                            w: 'var(--image-size-2)',
                                            h: 'var(--image-size-2)',
                                            type: 'svg',
                                            tooltip: displayName,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="nz-impersonate-footer">
                    <div className="nz-impersonate-footer-info">
                        {FnGetLoggedInStatusMessage(authSession)}
                    </div>
                    <button
                        type="button"
                        className="nz-impersonate-footer-btn"
                        onClick={handleClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </Dialog>
    );
};

export { Impersonate };
export default Impersonate;
export type { IAppqaImpersonateProps };
