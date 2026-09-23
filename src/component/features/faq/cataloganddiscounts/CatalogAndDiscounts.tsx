import { useState } from 'react'
import {useLoadRemoteJson} from '../../../shared/allcommon/LoadRemoteJsonHooks'

type CatalogItem = {
    sortorder: number
    productsku: string
    name: string
    image?: string
    description?: string
    price: number
    ['discountpercent?']?: number
    ['Taxable?']?: boolean
}

const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
})

const CatalogAndDiscounts = () => {
    const [items, setItems] = useState<CatalogItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [failedImageKeys, setFailedImageKeys] = useState<Set<string>>(new Set())

    useLoadRemoteJson({ bucket:'n20-bucket-01', baseFolder:'sm', fileName:'netzoomproductcatalog/netzoomproductcatalog.json', onSuccess:setItems, onError:setError })

    if (error) {
        return (
            <div style={{ padding: '1rem 0', color: '#b91c1c' }}>
                Error loading catalog: {error}
            </div>
        )
    }

    return (
        <section
            style={{
                padding: '0.5rem 0 1.25rem',
                maxHeight: '78vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '0.25rem',
            }}
        >
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.4rem' }}>Catalog and Discounts</h2>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '1rem',
                }}
            >
                {items.map((item) => {
                    const discount = item['discountpercent?'] ?? 0
                    const discountedPrice = item.price * (1 - discount / 100)
                    const imageSrc = item.image ? `/privateartifacts/${item.image}` : ''
                    const itemKey = `${item.productsku}-${item.sortorder}`
                    const hasImage = Boolean(imageSrc) && !failedImageKeys.has(itemKey)

                    return (
                        <article
                            key={itemKey}
                            style={{
                                border: '1px solid #d1d5db',
                                borderRadius: 12,
                                padding: '1rem',
                                backgroundColor: '#fff',
                                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                                display: 'grid',
                                gap: '0.5rem',
                            }}
                        >
                            {hasImage ? (
                                <img
                                    src={imageSrc}
                                    alt={item.name}
                                    style={{
                                        width: '100%',
                                        height: 70,
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#f8fafc',
                                        padding: '0.5rem',
                                    }}
                                    onError={() => {
                                        setFailedImageKeys((prev) => {
                                            if (prev.has(itemKey)) {
                                                return prev
                                            }
                                            const next = new Set(prev)
                                            next.add(itemKey)
                                            return next
                                        })
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: 70,
                                        borderRadius: 8,
                                        border: '1px dashed #cbd5e1',
                                        backgroundColor: '#f8fafc',
                                        color: '#64748b',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontSize: '10px',
                                    }}
                                >
                                    No image available
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <strong style={{ fontSize: '12px', lineHeight: 1.3 }}>{item.name}</strong>
                                <span
                                    style={{
                                        fontSize: '10px',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 999,
                                        padding: '0.15rem 0.5rem',
                                        whiteSpace: 'nowrap',
                                        height: 'fit-content',
                                    }}
                                >
                                    {item.productsku}
                                </span>
                            </div>

                            {item.description ? (
                                <p style={{ margin: 0, color: '#475569', fontSize: '10px' }}>{item.description}</p>
                            ) : null}

                            <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.25rem' }}>
                                <div style={{ color: '#111827', fontWeight: 600, fontSize: '10px' }}>
                                    Base Price: {money.format(item.price)}
                                </div>
                                {discount > 0 ? (
                                    <>
                                        <div style={{ color: '#0f766e', fontWeight: 600, fontSize: '10px' }}>
                                            Discount: {discount}%
                                        </div>
                                        <div style={{ color: '#111827', fontWeight: 700, fontSize: '10px' }}>
                                            Discounted Price: {money.format(discountedPrice)}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ color: '#334155', fontSize: '10px' }}>No discount</div>
                                )}
                                <div style={{ color: '#334155', fontSize: '10px' }}>
                                    Taxable: {item['Taxable?'] ? 'Yes' : 'No'}
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}

export { CatalogAndDiscounts }
export default CatalogAndDiscounts
