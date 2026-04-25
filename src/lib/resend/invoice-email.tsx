import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Row,
  Column,
  Hr,
  Img,
} from '@react-email/components'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

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
      <Head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        `}</style>
      </Head>
      <Body style={{
        backgroundColor: '#f0f4ed',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        margin: 0,
        padding: '40px 0',
      }}>
        <Container style={{ maxWidth: '580px', margin: '0 auto' }}>

          {/* ── Header card ───────────────────────────────────────── */}
          <Section style={{
            backgroundColor: '#0a0a0a',
            borderRadius: '16px 16px 0 0',
            padding: '20px 40px',
          }}>
            <Row>
              {/* Wolf logo — black bg blends with header */}
              <Column style={{ width: '72px', verticalAlign: 'middle' }}>
                <Img
                  src={`${BASE_URL}/wolf-logo.png`}
                  alt="Gray Wolf Workers"
                  width="60"
                  height="60"
                  style={{ display: 'block' }}
                />
              </Column>
              {/* Name */}
              <Column style={{ verticalAlign: 'middle', paddingLeft: '14px' }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: '700',
                  margin: '0',
                  lineHeight: '1.1',
                  letterSpacing: '-0.02em',
                }}>
                  Gray Wolf Workers
                </Text>
                <Text style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '11px',
                  fontWeight: '600',
                  margin: '4px 0 0',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  Lawn Care Services
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── Invoice meta bar ──────────────────────────────────── */}
          <Section style={{
            backgroundColor: '#ffffff',
            padding: '16px 40px',
            borderBottom: '1px solid #e8ede5',
          }}>
            <Row>
              <Column>
                <Text style={{
                  color: '#2d5a1b',
                  fontSize: '11px',
                  fontWeight: '700',
                  margin: '0',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                  Invoice
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ color: '#9ca39a', fontSize: '12px', margin: '0' }}>
                  <span style={{ color: '#52525b', fontWeight: '600' }}>
                    #{invoiceId.slice(-8).toUpperCase()}
                  </span>
                  {'  ·  '}
                  {periodLabel}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── Body ─────────────────────────────────────────────── */}
          <Section style={{ backgroundColor: '#ffffff', padding: '32px 40px 8px' }}>
            <Text style={{
              fontSize: '15px',
              color: '#27272a',
              margin: '0 0 4px',
              fontWeight: '500',
            }}>
              Hi {customerName},
            </Text>
            <Text style={{
              fontSize: '14px',
              color: '#71717a',
              margin: '0 0 32px',
              lineHeight: '1.65',
            }}>
              {aiMessage}
            </Text>
          </Section>

          {/* ── Line items ────────────────────────────────────────── */}
          <Section style={{ backgroundColor: '#ffffff', padding: '0 40px' }}>

            {/* Table header */}
            <Row style={{
              backgroundColor: '#f7f9f6',
              borderRadius: '8px',
            }}>
              <Column style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#a1a1aa',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 14px',
              }}>
                Description
              </Column>
              <Column style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#a1a1aa',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textAlign: 'center',
                width: '48px',
                padding: '10px 0',
              }}>
                Qty
              </Column>
              <Column style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#a1a1aa',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textAlign: 'right',
                width: '96px',
                padding: '10px 14px',
              }}>
                Amount
              </Column>
            </Row>

            {/* Divider */}
            <Hr style={{ borderColor: '#f0f0f0', margin: '0' }} />

            {/* Items */}
            {lineItems.map((item, i) => (
              <div key={i}>
                <Row style={{
                  borderBottom: i < lineItems.length - 1 ? '1px solid #f4f4f5' : 'none',
                }}>
                  <Column style={{ padding: '14px 14px' }}>
                    <Text style={{ fontSize: '14px', color: '#18181b', margin: '0', fontWeight: '500' }}>
                      {item.description}
                    </Text>
                    {item.quantity > 1 && (
                      <Text style={{ fontSize: '12px', color: '#a1a1aa', margin: '2px 0 0' }}>
                        {item.quantity} visits × ${item.unit_price.toFixed(2)}
                      </Text>
                    )}
                  </Column>
                  <Column style={{
                    fontSize: '13px',
                    color: '#71717a',
                    textAlign: 'center',
                    width: '48px',
                    padding: '14px 0',
                    verticalAlign: 'top',
                  }}>
                    {item.quantity}
                  </Column>
                  <Column style={{
                    fontSize: '14px',
                    color: '#18181b',
                    fontWeight: '600',
                    textAlign: 'right',
                    width: '96px',
                    padding: '14px 14px',
                    verticalAlign: 'top',
                  }}>
                    ${item.line_total.toFixed(2)}
                  </Column>
                </Row>
              </div>
            ))}

            <Hr style={{ borderColor: '#e8ede5', margin: '0' }} />

            {/* Subtotal (only if different from total) */}
            {subtotal !== total && (
              <Row style={{ padding: '10px 0 4px' }}>
                <Column style={{ fontSize: '13px', color: '#71717a', padding: '0 14px' }}>Subtotal</Column>
                <Column style={{ width: '48px' }} />
                <Column style={{
                  fontSize: '13px',
                  color: '#71717a',
                  textAlign: 'right',
                  width: '96px',
                  padding: '0 14px',
                }}>
                  ${subtotal.toFixed(2)}
                </Column>
              </Row>
            )}
          </Section>

          {/* ── Total due block ───────────────────────────────────── */}
          <Section style={{ backgroundColor: '#ffffff', padding: '12px 40px 36px' }}>
            <div style={{
              backgroundColor: '#1e4010',
              backgroundImage: 'linear-gradient(135deg, #2d5a1b 0%, #1a380e 100%)',
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'block',
            }}>
              <Row>
                <Column>
                  <Text style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '11px',
                    fontWeight: '600',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    margin: '0 0 2px',
                  }}>
                    Total Due
                  </Text>
                  <Text style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '12px',
                    margin: '0',
                  }}>
                    Due upon receipt
                  </Text>
                </Column>
                <Column style={{ textAlign: 'right' }}>
                  <Text style={{
                    color: '#ffffff',
                    fontSize: '28px',
                    fontWeight: '700',
                    margin: '0',
                    letterSpacing: '-0.02em',
                  }}>
                    ${total.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            </div>
          </Section>

          {/* ── Help note ─────────────────────────────────────────── */}
          <Section style={{
            backgroundColor: '#ffffff',
            padding: '0 40px 32px',
          }}>
            <Text style={{
              fontSize: '13px',
              color: '#a1a1aa',
              margin: '0',
              lineHeight: '1.6',
              borderTop: '1px solid #f4f4f5',
              paddingTop: '20px',
            }}>
              Questions about this invoice? Simply reply to this email and we&apos;ll get back to you quickly.
            </Text>
          </Section>

          {/* ── Footer ────────────────────────────────────────────── */}
          <Section style={{
            backgroundColor: '#0a0a0a',
            borderRadius: '0 0 16px 16px',
            padding: '20px 40px',
          }}>
            <Row>
              <Column>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0' }}>
                  Gray Wolf Workers
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '3px 0 0' }}>
                  Locally owned &amp; operated · Kendallville, IN
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '11px',
                  margin: '0',
                }}>
                  Thank you for your business!
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── Bottom padding ────────────────────────────────────── */}
          <Section style={{ padding: '24px 0 8px' }}>
            <Text style={{ textAlign: 'center', fontSize: '11px', color: '#b4b4b4', margin: '0' }}>
              This invoice was sent by Gray Wolf Workers
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
