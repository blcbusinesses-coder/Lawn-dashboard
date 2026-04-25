import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Row,
  Column,
} from '@react-email/components'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

interface InvoiceEmailProps {
  customerName: string
  invoiceId: string
  periodStart: string
  periodEnd: string
  lineItems: LineItem[]
  subtotal: number
  total: number
  aiMessage: string
  periodLabel: string
}

const green = '#2d5a1b'
const greenLight = '#eef3e8'
const greenMid = '#c8dfc0'
const zinc900 = '#18181b'
const zinc600 = '#52525b'
const zinc400 = '#a1a1aa'
const zinc100 = '#f4f4f5'
const zinc50  = '#fafafa'
const white   = '#ffffff'

export function InvoiceEmail({
  customerName,
  invoiceId,
  periodLabel,
  lineItems,
  subtotal,
  total,
  aiMessage,
}: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: zinc100, fontFamily: "'Helvetica Neue', Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', backgroundColor: white, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>

          {/* ── Header ─────────────────────────────────────────── */}
          <Section style={{ backgroundColor: green, padding: '28px 36px 24px' }}>
            {/* Logo row */}
            <Row>
              <Column style={{ width: '44px' }}>
                <div style={{
                  width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: white, fontWeight: 'bold', fontSize: '13px', margin: 0, letterSpacing: '0.05em' }}>GW</Text>
                </div>
              </Column>
              <Column>
                <Text style={{ color: white, fontWeight: 'bold', fontSize: '20px', margin: 0, lineHeight: 1 }}>
                  Gray Wolf Workers
                </Text>
                <Text style={{ color: greenMid, fontSize: '12px', margin: '3px 0 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Lawn Care Services
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── Invoice label bar ───────────────────────────────── */}
          <Section style={{ backgroundColor: greenLight, padding: '12px 36px', borderBottom: `1px solid ${greenMid}` }}>
            <Row>
              <Column>
                <Text style={{ color: green, fontSize: '13px', fontWeight: '600', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Invoice
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ color: zinc600, fontSize: '13px', margin: 0 }}>
                  #{invoiceId.slice(-8).toUpperCase()} &nbsp;·&nbsp; {periodLabel}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── Body ───────────────────────────────────────────── */}
          <Section style={{ padding: '32px 36px 24px' }}>
            <Text style={{ fontSize: '15px', color: zinc900, marginTop: 0, marginBottom: '4px' }}>
              Hi {customerName},
            </Text>
            <Text style={{ fontSize: '15px', color: zinc600, marginTop: 0, marginBottom: '32px', lineHeight: '1.6' }}>
              {aiMessage}
            </Text>

            {/* ── Line items table ─────────────────────────────── */}
            {/* Header row */}
            <Row style={{ backgroundColor: zinc50, borderRadius: '6px', padding: '8px 0' }}>
              <Column style={{ fontSize: '11px', color: zinc400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px' }}>
                Description
              </Column>
              <Column style={{ fontSize: '11px', color: zinc400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', width: '60px', padding: '8px 0' }}>
                Qty
              </Column>
              <Column style={{ fontSize: '11px', color: zinc400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: '100px', padding: '8px 12px' }}>
                Amount
              </Column>
            </Row>

            <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 4px' }} />

            {lineItems.map((item, i) => (
              <Row key={i} style={{ borderBottom: i < lineItems.length - 1 ? '1px solid #f4f4f5' : 'none' }}>
                <Column style={{ fontSize: '14px', color: zinc900, padding: '10px 12px' }}>
                  {item.description}
                  {item.quantity > 1 && (
                    <Text style={{ fontSize: '12px', color: zinc400, margin: '1px 0 0' }}>
                      {item.quantity} visits × ${item.unit_price.toFixed(2)}
                    </Text>
                  )}
                </Column>
                <Column style={{ fontSize: '14px', color: zinc600, textAlign: 'center', width: '60px', padding: '10px 0' }}>
                  {item.quantity}
                </Column>
                <Column style={{ fontSize: '14px', color: zinc900, fontWeight: '500', textAlign: 'right', width: '100px', padding: '10px 12px' }}>
                  ${item.line_total.toFixed(2)}
                </Column>
              </Row>
            ))}

            <Hr style={{ borderColor: '#e4e4e7', margin: '4px 0 0' }} />

            {/* Subtotal */}
            {subtotal !== total && (
              <Row style={{ marginTop: '8px' }}>
                <Column style={{ fontSize: '13px', color: zinc600, padding: '4px 12px' }}>Subtotal</Column>
                <Column style={{ width: '60px' }} />
                <Column style={{ fontSize: '13px', color: zinc600, textAlign: 'right', width: '100px', padding: '4px 12px' }}>
                  ${subtotal.toFixed(2)}
                </Column>
              </Row>
            )}

            {/* Total due — highlighted */}
            <Row style={{ backgroundColor: greenLight, borderRadius: '8px', marginTop: '8px' }}>
              <Column style={{ fontSize: '15px', fontWeight: '700', color: green, padding: '12px 14px' }}>
                Total Due
              </Column>
              <Column style={{ width: '60px' }} />
              <Column style={{ fontSize: '18px', fontWeight: '700', color: green, textAlign: 'right', width: '100px', padding: '12px 14px' }}>
                ${total.toFixed(2)}
              </Column>
            </Row>
          </Section>

          {/* ── CTA note ───────────────────────────────────────── */}
          <Section style={{ padding: '0 36px 28px' }}>
            <Text style={{ fontSize: '13px', color: zinc600, lineHeight: '1.6', margin: 0 }}>
              Questions about this invoice? Reply to this email or give us a call — we&apos;re happy to help.
            </Text>
          </Section>

          {/* ── Footer ─────────────────────────────────────────── */}
          <Section style={{ backgroundColor: zinc50, borderTop: '1px solid #e4e4e7', padding: '16px 36px' }}>
            <Row>
              <Column>
                <Text style={{ fontSize: '12px', color: zinc400, margin: 0 }}>
                  Gray Wolf Workers &nbsp;·&nbsp; Locally owned &amp; operated
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: '12px', color: zinc400, margin: 0 }}>
                  Thank you for your business!
                </Text>
              </Column>
            </Row>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
