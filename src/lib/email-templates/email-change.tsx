import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a troca de e-mail na {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>iMAG</Text>
        <Heading style={h1}>Confirme seu novo e-mail</Heading>
        <Text style={text}>
          Você pediu para trocar o e-mail da sua conta na {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Clique no botão abaixo para confirmar a alteração:</Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar troca de e-mail
        </Button>
        <Text style={footer}>
          Se você não solicitou esta alteração, proteja sua conta imediatamente.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: '#0B0B0B' }
const container = { maxWidth: '520px', margin: '0 auto', padding: '40px 32px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.18em', color: '#335CFF', textTransform: 'uppercase' as const, margin: '0 0 32px' }
const h1 = { fontSize: '26px', fontWeight: 600 as const, color: '#0B0B0B', letterSpacing: '-0.02em', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#335CFF', textDecoration: 'underline' }
const button = { backgroundColor: '#0B0B0B', color: '#ffffff', fontSize: '14px', fontWeight: 500 as const, borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 32px' }
const footer = { fontSize: '12px', color: '#8a8a8a', lineHeight: '1.5', margin: '32px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px' }
