import React, { memo, useMemo } from "react";
import type { CSSProperties } from "react";
/*
How to use:
      <PlainEmailSignature name="Mgs Yadav" title="Product Designer" company="NetZoom, Inc."
        email="mgsy@NetZoom.com" phone="+1 630 281 6464" website="www.NetZoom.com"
        disclaimer='© 2024 NetZoom, Inc. All rights reserved.'
        />        

        
use these <symbols />
Mail (Envelope): ✉ (&#9993; or \u2709) Phone: 📞 (&#128222; or \U0001F4DE) or 📱 (&#128241; or \U0001F4F1)Globe: 🌐 (&#127760; or \U0001F310) Pin (Location): 📍 (&#128205; or \U0001F4CD)
*/

interface IPlainEmailSignatureProps 
{
  name: string;
  title?: string;
  department?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  logoUrl?: string;
  disclaimer?: string;
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
  specialNote?: string;
}

/* ------------------------------- helpers ------------------------------- */

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Returns the URL only when it uses a safe protocol (blocks javascript:, data:, etc.). */
export const sanitizeUrl = (url?: string): string | null => {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed, "https://placeholder.invalid");
    return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
};

const ensureProtocol = (url?: string): string | undefined => {
  if (!url) return undefined;
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
};

const displayUrl = (url: string): string =>
  url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;

const isValidEmail = (value?: string): value is string =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const PlainEmailSignature = ({
  name,
  title,
  department,
  company,
  email,
  phone,
  mobile,
  website,
  address,
  logoUrl,
  disclaimer,
  fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  className,
  style,
  specialNote,
}: IPlainEmailSignatureProps) => {

  const s = useMemo(() => {
    const reset: CSSProperties = { margin: 0, padding: 0, boxSizing: "border-box" };
    return {
      root: {
        ...reset,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        marginLeft: 10,
        padding: 10,
        maxWidth: 560,
        fontFamily,
        fontSize: 12,
        lineHeight: 1,
        letterSpacing: "-0.01em",
        ...style,
      } as CSSProperties,

      name: {...reset, marginTop: "4px",fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif', fontSize: 10, lineHeight: 1.1 } as CSSProperties,
      company: {...reset, marginTop: "4px", fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif', fontSize: 10, lineHeight: 1.1 } as CSSProperties,
      role: { ...reset, fontSize: 10, } as CSSProperties,
      link: {...reset,fontSize: 10,  fontWeight: 300 } as CSSProperties,

      disclaimer: {
        ...reset,
        flexBasis: "100%",
        paddingTop: 6,
        fontSize: 10,
        lineHeight: 1,
        color: "#6b7280",
      } as CSSProperties,
    };
  }, [ fontFamily, style]);

  const safeWebsite = sanitizeUrl(ensureProtocol(website));
  if (!name?.trim()) return null;

  const roleLine = [title, department].filter(Boolean).join(", ");

  return (
    <>
    <div style={{ marginLeft: 10 }}>
      {name && <p style={s.name}>{name}</p>}
      {roleLine && <p style={s.role}>{roleLine}</p>}

      {company && <p style={s.company}>{company}</p>}
      {phone && <p style={s.link}>Phone: {phone}</p>}
      {email && <p style={s.link}>Email: {email}</p>}
      {website && <p style={s.link}>{safeWebsite}</p>}
      {specialNote && <p style={s.link}>{<br />}Note: {specialNote}</p>}
    </div>

    <div style={{ marginLeft: 10 }}>
      {disclaimer && <p style={s.disclaimer}>{disclaimer}</p>}
    </div>
    </>

  );
};

export default memo(PlainEmailSignature);
export type { IPlainEmailSignatureProps };
