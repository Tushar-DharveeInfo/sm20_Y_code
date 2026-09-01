
import { useState, useEffect, useRef } from 'react'
import { YesNoForm } from '@n20a/libform'

type ServicesRedirectProps = {
    bid?: string | number;
    cid?: string | number;
}

function ServicesExternalRedirect({ bid, cid }: ServicesRedirectProps) {
    const hasOpenedRef = useRef<boolean>(false);

    useEffect(() => {
        if (hasOpenedRef.current) {
            return;
        }
        hasOpenedRef.current = true;

        const bidParam = String(bid ?? '');
        const cidParam = String(cid ?? '');
        const params = new URLSearchParams({ ...(bidParam && { bid: bidParam }), ...(cidParam && { cid: cidParam }) });
        window.open(`https://service20.netzoom.com${params.size ? `?${params}` : ''}`, 'SM-Service', 'noopener,noreferrer');
    }, [bid, cid]);

    return null;
}
interface ImpersonateUserProps {
    data: {
        tenantshortname: string
        userid: string
    }

    onYesClick?: (data: {
        tenantshortname: string
        userid: string
    }) => void
}

export const ImpersonateUser = ({ data }: ImpersonateUserProps) => {
    const [launch, setLaunch] = useState(false)

    const handleYes = () => {
        console.log("data", data)
        // setLaunch(true); console.log("ImpersonateUser handleYes clicked", data)
    }

    const YesNoFormProps = {
        title: "Want to Impersonate user",
        message: `Ready to launch Service portal and Impersonate as ${data.userid} of ${data.tenantshortname} ?`,
        buttonLabels: ["Yes"],
        onButtonClick: handleYes
    }

    return (
        <>
            {
                <YesNoForm {...YesNoFormProps} />
            }
        </>
    );
}