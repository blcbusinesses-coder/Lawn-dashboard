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
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Header */}
          <Section style={{ backgroundColor: '#18181b', padding: '24px 32px' }}>
            <Heading style={{ color: '#ffffff', margin: 0, fontSize: '22px' }}>
              Gray Wolf Workers
            </Heading>
            <Text style={{ color: '#a1a1aa', margin: '4px 0 0', fontSize: '13px' }}>
              Lawn Care Services
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <Text style={{ fontSize: '15px', color: '#3f3f46', marginTop: 0 }}>
              Hi {customerName},
            </Text>
            <Text style={{ fontSize: '15px', color: '#3f3f46' }}>
              {aiMessage}
            </Text>

            <Heading as="h2" style={{ fontSize: '16px', color: '#18181b', marginTop: '32px', marginBottom: '8px' }}>
              Invoice #{invoiceId.slice(-8).toUpperCase()} · {periodLabel}
            </Heading>

            <Hr style={{ borderColor: '#e4e4e7' }} />

            {/* Line items */}
            {lineItems.map((item, i) => (
              <Row key={i} style={{ marginBottom: '8px' }}>
                <Column style={{ fontSize: '14px', color: '#52525b' }}>
                  {item.description}
                </Column>
                <Column style={{ fontSize: '14px', color: '#52525b', textAlign: 'right', width: '80px' }}>
                  x{item.quantity}
                </Column>
                <Column style={{ fontSize: '14px', color: '#18181b', textAlign: 'right', width: '100px' }}>
                  ${item.line_total.toFixed(2)}
                </Column>
              </Row>
            ))}

            <Hr style={{ borderColor: '#e4e4e7' }} />

            <Row style={{ marginTop: '8px' }}>
              <Column style={{ fontSize: '14px', color: '#52525b' }}>Subtotal</Column>
              <Column style={{ fontSize: '14px', textAlign: 'right' }}>${subtotal.toFixed(2)}</Column>
            </Row>
            <Row style={{ marginTop: '4px' }}>
              <Column style={{ fontSize: '16px', fontWeight: 'bold', color: '#18181b' }}>Total Due</Column>
              <Column style={{ fontSize: '16px', fontWeight: 'bold', color: '#18181b', textAlign: 'right' }}>${total.toFixed(2)}</Column>
            </Row>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#f4f4f5', padding: '16px 32px' }}>
            <Text style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>
              Gray Wolf Workers · Thank you for your business!
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
