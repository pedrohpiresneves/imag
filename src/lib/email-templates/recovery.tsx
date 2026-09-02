import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha na {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>iMAG</Text>
        <Heading style={h1}>Redefina sua senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta na {siteName}. Clique no botão abaixo para escolher uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Redefinir senha
        </Button>
        <Text style={footer}>
          Se você não solicitou a redefinição, ignore este e-mail — sua senha continuará a mesma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: '#0B0B0B' }
const container = { maxWidth: '520px', margin: '0 auto', padding: '40px 32px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.18em', color: '#335CFF', textTransform: 'uppercase' as const, margin: '0 0 32px' }
const h1 = { fontSize: '26px', fontWeight: 600 as const, color: '#0B0B0B', letterSpacing: '-0.02em', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#0B0B0B', color: '#ffffff', fontSize: '14px', fontWeight: 500 as const, borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 32px' }
const footer = { fontSize: '12px', color: '#8a8a8a', lineHeight: '1.5', margin: '32px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px' }
