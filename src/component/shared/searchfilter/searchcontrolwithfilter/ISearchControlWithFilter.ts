
import { ReactNode } from 'react';
import { IControl } from '../../allinterface/settingsform/ISettingsLibForm';
import { ISearchControl } from '../../allinterface/searchfilter/ISearchControl';

interface ICascadeFilterContext {
    uniqueName: string;
    loginType?: string;
    profileSiteName: string;
    onValuesChange: (
        values: object,
        options?: { isDefault?: boolean }
    ) => void;
}

interface ISearchControlWithFilter {
    uniqueName: string; //Unique identifier for the control
    controls: IControl[];
    searchProps: ISearchControl;
    fromProfileString?: string;
    filterIconTooltip?: string;
    /*
     * When true, site/tenant/user fields are rendered via cascade UI instead of SettingsContainer.
     * Use with `renderCascadeFilter` to plug in a cascade component (e.g. SiteTenantUserCascade).
     */
    allowSiteUserCascade?: boolean;
    /* When "node", site combo is read-only (session site). Passed to cascade render props. */
    loginType?: string;
    /*
     * Renders the site/tenant/user cascade block above SettingsContainer.
     * Forensic Log passes SiteTenantUserCascade; other filters can supply their own cascade.
     */
    renderCascadeFilter?: (context: ICascadeFilterContext) => ReactNode;
    /*
     * Form control names (lowercase) owned by the cascade and excluded from SettingsContainer.
     * Defaults to SiteName, TenantName, UserName, CompanyName, Users.
     */
    cascadeControlNames?: string[];
    handleFilterFormData?: (value: Record<string, unknown>) => void;
    handleLensFormData?: (value: Record<string, unknown>) => void;
    handleFilterFormClick?: () => void;
}

export type { ICascadeFilterContext, ISearchControlWithFilter }