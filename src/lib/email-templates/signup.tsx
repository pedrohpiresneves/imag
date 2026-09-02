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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso à {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>iMAG</Text>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Obrigado por se juntar à{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Falta só um passo para começar.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para confirmar o endereço{' '}
          <strong>{recipient}</strong> e entrar na iMAG. O link expira em alguns minutos.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar na iMAG
        </Button>
        <Text style={small}>
          Se o botão não funcionar, copie e cole este endereço no navegador:
        </Text>
        <Text style={urlText}>{confirmationUrl}</Text>
        <Text style={footer}>
          Se você não criou uma conta na iMAG, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: '#0B0B0B' }
const container = { maxWidth: '520px', margin: '0 auto', padding: '40px 32px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.18em', color: '#335CFF', textTransform: 'uppercase' as const, margin: '0 0 32px' }
const h1 = { fontSize: '26px', fontWeight: 600 as const, color: '#0B0B0B', letterSpacing: '-0.02em', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#335CFF', textDecoration: 'underline' }
const button = { backgroundColor: '#335CFF', borderRadius: '999px', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, textDecoration: 'none', textAlign: 'center' as const, display: 'block', padding: '14px 24px', margin: '4px 0 28px' }
const small = { fontSize: '13px', color: '#8a8a8a', lineHeight: '1.5', margin: '0 0 6px' }
const urlText = { fontSize: '12px', color: '#335CFF', wordBreak: 'break-all' as const, margin: '0' }
const footer = { fontSize: '12px', color: '#8a8a8a', lineHeight: '1.5', margin: '32px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px' }
