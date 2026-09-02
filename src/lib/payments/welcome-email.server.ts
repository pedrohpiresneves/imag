// Welcome email pós-pagamento.
// Implementação inicial: log-only. Para ativar envio real, use o tool
// email_domain--scaffold_transactional_email_templates (requer domínio
// de email verificado) e substitua o corpo abaixo por sendTemplateEmail.
export async function sendWelcomeEmail(input: {
  email: string;
  actionLink: string;
  created: boolean;
}): Promise<void> {
  console.log("[welcome-email] TODO enviar para", input.email, {
    accountCreated: input.created,
    actionLink: input.actionLink,
  });
}