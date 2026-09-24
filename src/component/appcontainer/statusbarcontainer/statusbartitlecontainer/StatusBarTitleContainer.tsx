
import React, { JSX, useEffect, useState } from 'react';
import { Close24x24, Copy24x24, Down24x24, NoInternet, Secured24x24, Up24x24 } from '@n20a/libicon';
import './StatusBarTitleContainer.css';
import { FnGetCssVariable } from '../../allcommon/FnGetCssVariable.ts';
import { FnCopyToClipboard } from '../../../shared/allcommon/basic/FnCopyToClipboard.ts';
import { Label } from '../../../shared/basic/label/Label.tsx';
import { ActionImage } from '../../../shared/basic/actionimage/ActionImage.tsx';
import { Image } from '../../../shared/basic/image/Image.tsx';


interface IStatusBarTitleContainer {
    uniqueName: string;
    isError: boolean;
    titleData: string | string[];
    isOpen: boolean;
    cardsCount: number;
    isInternetAvailable: boolean;
    isSiteLocked?: boolean;
    isSiteManaged?: boolean;
    handleOpenCloseStatusBar: () => void;
    criticalAlertCount?: number;
    isShowFullTitle?: boolean;
    handleShowFullTitle?: () => void;
    handleClearClick?: () => void;
    isImpersonating?: boolean;
    impersonatedUser?: string;
    loginUser?: string;
    handleQuitImpersonate?: () => void;
}
const StatusBarTitleContainer = (statusBarTitleContainerProps: IStatusBarTitleContainer) => {
    // console.log('statusBarTitleContainerProps :', statusBarTitleContainerProps);
    const [titleContent, setTitleContent] = useState<JSX.Element>();
    const [contentToCopy, setContentToCopy] = useState<string>();

    const { isOpen, cardsCount, criticalAlertCount } = statusBarTitleContainerProps;
    useEffect(() => {
        if (typeof statusBarTitleContainerProps.titleData === "string") {
            setTitleContent(<Label fontWeight='bold' uniqueName={`${statusBarTitleContainerProps.uniqueName}-header`} label={statusBarTitleContainerProps.titleData} />);
            setContentToCopy(statusBarTitleContainerProps.titleData);
        }
        else if (Array.isArray(statusBarTitleContainerProps.titleData)) {
            const renderTitleContent = () => {
                const { titleData, isShowFullTitle, handleShowFullTitle } = statusBarTitleContainerProps;

                if (!Array.isArray(titleData) || titleData.length === 0) return <></>;

                // Full title mode
                if (isShowFullTitle) {
                    return (
                        <>
                            {titleData.map((str, idx) => (
                                <span key={idx}>
                                    {str}
                                    {idx < titleData.length - 1 && (
                                        <span style={{ color: 'var(--bgexplorer)', padding: '0 4px' }}>|</span>
                                    )}
                                </span>
                            ))}
                        </>
                    );
                }


                // Collapsed mode: show all title lines (Site/Tenant truncation removed).
                const filteredTitleData = [...titleData];
                const showEllipsis = false;

                return (
                    <>
                        {filteredTitleData.map((str, idx) => (
                            <span key={idx}>
                                {str}
                                {idx < filteredTitleData.length - 1 && (
                                    <span style={{ color: 'var(--bgexplorer)', padding: '0 4px' }}>|</span>
                                )}
                                {idx === filteredTitleData.length - 1 && showEllipsis && (
                                    <span
                                        onClick={handleShowFullTitle}
                                        title='Click to view status'
                                        style={{
                                            cursor: 'pointer',
                                            paddingLeft: 'var(--spacing-0)',
                                            fontWeight: 600,
                                            color: 'var(--textprimary)',
                                        }}
                                    >
                                        ...
                                    </span>
                                )}
                            </span>
                        ))}
                    </>
                );
            };

            // Usage
            setTitleContent(renderTitleContent());

            setContentToCopy(statusBarTitleContainerProps.titleData.join('|'));
        }

    }, [statusBarTitleContainerProps.titleData
        , statusBarTitleContainerProps.isInternetAvailable
        , statusBarTitleContainerProps.uniqueName
        , statusBarTitleContainerProps.isShowFullTitle
        , statusBarTitleContainerProps.handleShowFullTitle
    ]);


    return (
        <div
            className={`nz-statusbar-title-container ${statusBarTitleContainerProps.isImpersonating ? "nz-statusbar-title-impersonating" : ""}`}
            style={statusBarTitleContainerProps.isImpersonating ? { backgroundColor: '#dcfce7' } : undefined}
        >
            <div className='nz-statusbar-title-left'>
                {statusBarTitleContainerProps.cardsCount > 0 && <ActionImage
                    image={{
                        uniqueName: "up-down-i",
                        source: isOpen ? <Down24x24
                            size={FnGetCssVariable('--image-size-1')}
                            fill='none'
                            strokeWidth={1} /> : <Up24x24
                            size={FnGetCssVariable('--image-size-1')}
                            fill='none'
                            strokeWidth={1} />,
                        type: "svg",
                        w: "var(--image-size-1)",
                        h: "var(--image-size-1)",
                        tooltip: isOpen ? "Close" : "Open"
                    }}
                    uniqueName='up-down-ai'
                    w='var(--node_height)'
                    h='var(--node_height)'
                    actionCode={'copymdstring'}
                    handleMouse={() => {
                        statusBarTitleContainerProps.handleOpenCloseStatusBar();
                    }}
                />}
                {!statusBarTitleContainerProps.cardsCount && (
                    <>
                        {!statusBarTitleContainerProps.isInternetAvailable && (
                            <Image
                                uniqueName="no-internet-i"
                                source={<NoInternet
                                    size={FnGetCssVariable('--image-size-1')}
                                    fill='none'
                                    strokeWidth={1}
                                />}
                                type="svg"
                                w="var(--image-size-1)"
                                h="var(--image-size-1)"
                                tooltip="No Internet Found"
                            />
                        )}

                    </>
                )}

                <div className='nz-statusbar-title-content'>
                    {!isOpen ? titleContent : `Notification${cardsCount > 0 ? ` (${cardsCount}${criticalAlertCount ? `, Critical : ${criticalAlertCount}` : ""})` : ""}`}
                    {!isOpen && statusBarTitleContainerProps.isImpersonating && (
                        <ActionImage
                            uniqueName={`${statusBarTitleContainerProps.uniqueName}-quit-impersonate`}
                            image={{
                                uniqueName: `${statusBarTitleContainerProps.uniqueName}-quit-impersonate-img`,
                                source: <Close24x24
                                    size={FnGetCssVariable('--image-size-1', '16px')}
                                    fill='none'
                                    strokeWidth={1} />,
                                type: "svg",
                                w: "var(--image-size-1)",
                                h: "var(--image-size-1)",
                                tooltip: "Quit Impersonating",
                            }}
                            w="var(--node_height)"
                            h="var(--node_height)"
                            actionCode={'quitImpersonate'}
                            tooltip="Quit Impersonating"
                            handleMouse={(event: any) => {
                                event?.stopPropagation?.();
                                statusBarTitleContainerProps.handleQuitImpersonate?.();
                            }}
                        />
                    )}
                </div>

            </div>
            <div className={`nz-statusbar-info-action-icons`}>
                {!isOpen && contentToCopy ? <ActionImage
                    image={{
                        uniqueName: "copy",
                        source: <Copy24x24
                            size={FnGetCssVariable('--image-size-1')}
                            fill='none'
                            strokeWidth={1} />,
                        type: "svg",
                        w: "var(--image-size-1)",
                        h: "var(--image-size-1)",
                        tooltip: "Copy Data"
                    }}
                    uniqueName='copy'
                    w="var(--node_height)"
                    h="var(--node_height)"
                    actionCode={'copymdstring'}
                    handleMouse={() => {
                        if (contentToCopy)
                            FnCopyToClipboard(contentToCopy)
                    }}
                /> : <></>}

                {statusBarTitleContainerProps.cardsCount > 0 && <div className='nz-statusbar-close-error'>
                    <div className={statusBarTitleContainerProps.isError ? ' nz-pulse' : ""}>
                        <ActionImage uniqueName={`${statusBarTitleContainerProps.uniqueName}-close-error`}
                            image={{
                                uniqueName: `${statusBarTitleContainerProps.uniqueName}-close-image`,
                                source: <Close24x24
                                    size={FnGetCssVariable('--image-size-1')}
                                    fill='none'
                                    strokeWidth={1} />,
                                type: "svg",
                                w: "var(--image-size-1)",
                                h: "var(--image-size-1)",
                                tooltip: "Clear all notification",
                            }
                            } w={'var(--node_height)'} actionCode={'close'} handleMouse={(event: any, actionCode?: string, payload?: any) => {
                                if (statusBarTitleContainerProps.handleClearClick) {
                                    statusBarTitleContainerProps.handleClearClick()
                                }
                            }} />

                    </div>

                </div>}
            </div>

        </div>
    )
}
export { StatusBarTitleContainer }
