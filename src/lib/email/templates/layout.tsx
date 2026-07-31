import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { BRAND_NAME } from "@/config/brand";

/**
 * The frame every message this app sends is drawn in: mark, body, footer.
 *
 * **Inline styles, and that is not the app's rule being broken.** Email has no
 * cascade worth trusting — Gmail strips `<style>` blocks in some clients, and
 * custom properties resolve nowhere — so every value has to travel on the
 * element. Which also means the design tokens cannot come along: these are the
 * brand's own hex values, copied deliberately and marked as such, because the
 * alternative is a message that arrives unstyled.
 *
 * **Raster, not vector.** The app renders SVG marks; email clients do not
 * reliably render SVG at all, and Outlook does not. So both marks ship as PNG
 * beside their vectors, and the URLs are absolute — a relative path in an inbox
 * resolves against the mail client, not against this app.
 *
 * **One finish, not two.** The page swaps the Vennet mark for a light version
 * in dark mode; an email cannot, because `prefers-color-scheme` reaches only
 * some clients and there is no second chance to correct it. Ink on paper is the
 * pair that survives a client deciding to invert things on its own.
 */

/** The brand's own values, written out because email cannot resolve a token. */
const COLORS = {
  paper: "#faf7f2",
  card: "#ffffff",
  ink: "#09090b",
  text: "#57534e",
  muted: "#8a8378",
  line: "#e4ded4",
  link: "#d9541f",
} as const;

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface LayoutProps {
  /** The line inboxes show beside the subject, before anything is opened. */
  preview: string;
  /** Absolute origin of this deployment, for the images and any link. */
  origin: string;
  children: ReactNode;
}

export function EmailLayout({ preview, origin, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.paper,
          fontFamily: FONT,
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: "16px",
            margin: "0 auto",
            maxWidth: "520px",
            padding: "32px",
          }}
        >
          {/* The chapa, at the width the kit calls legible. */}
          <Section style={{ paddingBottom: "24px" }}>
            <Img
              src={`${origin}/brand/junti-chapa-principal.png`}
              alt={BRAND_NAME}
              width="88"
              height="51"
              style={{ display: "block" }}
            />
          </Section>

          {children}

          <Hr style={{ borderColor: COLORS.line, margin: "32px 0 20px" }} />

          {/*
            The same attribution the app's own footer carries, in the same
            words the Vennet manual prescribes — a message that credits its
            maker differently from the page it came from reads as a forgery.
          */}
          <Section>
            <Img
              src={`${origin}/brand/vennet-mark-ink.png`}
              alt=""
              width="72"
              height="16"
              style={{ display: "block", marginBottom: "12px", opacity: 0.75 }}
            />
            <Text style={{ color: COLORS.muted, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
              © {new Date().getFullYear()} {BRAND_NAME} by Vennet
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared type styles, so every message's body reads the same. */
export const emailText = {
  heading: {
    color: COLORS.ink,
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "30px",
    margin: "0 0 12px",
  },
  paragraph: {
    color: COLORS.text,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: COLORS.ink,
    borderRadius: "999px",
    color: COLORS.paper,
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
  },
} as const;
