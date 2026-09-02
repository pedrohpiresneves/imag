import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação iMAG</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>iMAG</Text>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em alguns minutos. Se você não solicitou, ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: '#0B0B0B' }
const container = { maxWidth: '520px', margin: '0 auto', padding: '40px 32px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.18em', color: '#335CFF', textTransform: 'uppercase' as const, margin: '0 0 32px' }
const h1 = { fontSize: '26px', fontWeight: 600 as const, color: '#0B0B0B', letterSpacing: '-0.02em', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: "'Geist Mono', 'Courier New', monospace", fontSize: '32px', fontWeight: 600 as const, letterSpacing: '0.4em', color: '#0B0B0B', backgroundColor: '#f5f5f5', borderRadius: '10px', padding: '20px 24px', textAlign: 'center' as const, margin: '0 0 32px' }
const footer = { fontSize: '12px', color: '#8a8a8a', lineHeight: '1.5', margin: '32px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px' }
