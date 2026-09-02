export type Module = {
  slug: string;
  number: number;
  title: string;
  subtitle: string;
  intro: string;
  paragraphs: string[];
  quote?: string;
  freePreview?: number; // number of paragraphs shown without paywall
};

/** Visual identity per chapter — for Library covers. */
export const MODULE_META: Record<string, { gradient: string; duration: string; ink?: "light" | "dark" }> = {
  "principios-do-magnetismo":    { gradient: "linear-gradient(160deg,#3A2A12 0%,#8B6A2E 55%,#C6A15B 100%)", duration: "12 min" },
  "mentalidade-magnetica":       { gradient: "linear-gradient(160deg,#0A1E24 0%,#134152 55%,#2E7A8E 100%)", duration: "18 min" },
  "comportamento-magnetico":     { gradient: "linear-gradient(160deg,#0B1F14 0%,#12442C 55%,#2C8A5E 100%)", duration: "15 min" },
  "comunicacao-magnetica":       { gradient: "linear-gradient(160deg,#1A0B24 0%,#3A1A52 55%,#6B32A0 100%)", duration: "17 min" },
  "autoridade-silenciosa":       { gradient: "linear-gradient(160deg,#1B1B1B 0%,#2E2E2E 55%,#5A5A5A 100%)", duration: "14 min" },
  "sistema-de-atracao":          { gradient: "linear-gradient(160deg,#2C120A 0%,#6E2E14 55%,#B85A2C 100%)", duration: "16 min" },
  "conversao-sem-esforco":       { gradient: "linear-gradient(160deg,#1F1A0A 0%,#4A3E14 55%,#8E7028 100%)", duration: "13 min" },
  "retencao-e-indicacao":        { gradient: "linear-gradient(160deg,#0F1A24 0%,#1E3A5A 55%,#3E6EA0 100%)", duration: "15 min" },
  "a-agenda-magnetica":          { gradient: "linear-gradient(160deg,#2A0F1F 0%,#5A1E42 55%,#A0348A 100%)", duration: "20 min" },
  "manifesto-agenda-magnetica":  { gradient: "linear-gradient(160deg,#0A0A0A 0%,#1F1F1F 55%,#C6A15B 130%)", duration: "5 min" },
};

export function moduleMeta(slug: string) {
  return MODULE_META[slug] ?? { gradient: "linear-gradient(160deg,#1B1B1B,#3A3A3A)", duration: "" };
}

export const MODULES: Module[] = [
  {
    slug: "principios-do-magnetismo",
    number: 1,
    title: "Os Princípios do Magnetismo",
    subtitle: "Por que algumas pessoas atraem naturalmente?",
    intro:
      "Você já observou que algumas pessoas, sem dizer uma palavra, já são notadas? Não é beleza. Nem mesmo talento técnico. É magnetismo — e ele pode ser aprendido.",
    freePreview: 0,
    paragraphs: [
      "O magnetismo pessoal e profissional não nasce de quem grita mais alto ou aparece com mais frequência. Ele nasce de uma presença calibrada: a capacidade de ocupar espaço sem invadir, de comunicar valor sem implorar atenção, de ser desejado antes de ser conhecido.",
      "\"Pessoas magnéticas não perseguem clientes. Elas criam condições para que os clientes as encontrem — e queiram ficar.\"",
      "Neste capítulo, vamos entender três forças que regem o magnetismo humano no contexto profissional: percepção de valor, consistência de presença e clareza de posicionamento. Sem esses três pilares, qualquer estratégia de atração se torna esforço desperdiçado.",
      "I. Percepção de Valor: Antes da técnica, antes do preço, existe uma percepção — e ela é construída conscientemente. Antes de comprar o que você faz, o cliente compra o que ele acredita que vai receber.",
      "II. Consistência de Presença: Magnetismo não é um evento. É um padrão. A confiança se constrói pelo que você repete.",
      "III. Clareza de Posicionamento: Quem tenta falar para todos não fala para ninguém. A clareza sobre quem você é e para quem serve cria o campo gravitacional que atrai as pessoas certas.",
      "Quando esses três elementos estão alinhados, algo extraordinário acontece: você para de buscar clientes e começa a recebê-los. Essa é a base de tudo que vamos construir juntos ao longo deste manual.",
    ],
    quote: "Magnetismo não se impõe. Se irradia.",
  },
  {
    slug: "mentalidade-magnetica",
    number: 2,
    title: "Mentalidade Magnética",
    subtitle: "O pensamento por trás da atração.",
    intro:
      "Antes de qualquer estratégia, existe uma crença. E é exatamente aqui que a maioria das pessoas trava sem perceber.",
    paragraphs: [
      "Elas aprendem as técnicas, copiam os scripts, seguem trends virais, investem em fotos profissionais, equipe de marketing, tráfego pago — e ainda assim, a agenda não preenche. Por quê?",
      "O problema raramente é o método. É o que acontece nos bastidores da mente quando ninguém está olhando: a dúvida sobre o próprio valor, o medo de parecer \"vendedora demais\", a sensação de que precisar de clientes é sinônimo de fragilidade.",
      "A mentalidade magnética começa com uma virada fundamental: de carência para abundância. Não abundância financeira — essa é consequência. Mas abundância de perspectiva: a certeza profunda de que o que você oferece tem valor real, e que as pessoas certas vão reconhecer esse valor quando o momento for o certo para elas.",
      "Isso não é pensamento positivo vazio. É postura estratégica. Quando você opera a partir da carência, suas ações comunicam desespero — mesmo quando as palavras são profissionais. O tom muda. A frequência muda. E o cliente sente.",
      "\"A pessoa com mentalidade magnética não precisa convencer. Ela se apresenta. Quem reconhece valor, se aproxima. Quem não reconhece, segue em frente — e isso também é uma vitória.\"",
      "I. Abandone a mentalidade de perseguição: Clientes não são alvos a serem capturados. São pessoas que precisam encontrar a solução certa. Seu papel é ser encontrável e reconhecível, não incessante.",
      "II. Cultive confiança baseada em evidências: Liste resultados reais que você já entregou. Leia depoimentos. Relembre transformações. A confiança magnética não é arrogância — é memória ativa do seu impacto.",
      "III. Defina com quem você quer trabalhar: A clareza sobre seu cliente ideal não é luxo de quem já tem agenda cheia. É o pré-requisito para construí-la. Atrair a todos significa não atrair ninguém de verdade.",
    ],
  },
  {
    slug: "comportamento-magnetico",
    number: 3,
    title: "Comportamento Magnético",
    subtitle: "A linguagem invisível do valor.",
    intro:
      "Muito antes das palavras, existe o comportamento. E ele comunica tudo o que você preferia não revelar: sua segurança, sua percepção do próprio valor, sua relação com o dinheiro e com o reconhecimento.",
    freePreview: 1,
    paragraphs: [
      "O comportamento magnético não é sobre ser extrovertida ou ter uma personalidade marcante.",
      "É sobre coerência entre o que você pensa, o que você diz e como você age. Quando essas três coisas se alinham, você passa a transmitir uma energia que as pessoas simplesmente sentem — mas raramente conseguem nomear.",
      "Experiência pessoal: Durante muito tempo achei que precisava aparecer mais para atrair pacientes. Mas percebi algo curioso: os pacientes que mais procuraram pelo meu trabalho raramente chegavam por causa de um story \"agenda aberta\". Eles chegavam porque acompanhavam meu comportamento ao longo do tempo e já confiavam em mim antes mesmo da primeira consulta.",
      "O comportamento magnético é construído a partir de: limites claros; presença tranquila; decisões alinhadas com o posicionamento desejado; coerência entre o que você pensa, o que você fala e o que você faz.",
      "\"Você não precisa explicar seus preços para o cliente certo. Para o cliente errado, nenhuma explicação será suficiente.\"",
      "Aprenda a identificar os comportamentos que comunicam alto valor silenciosamente — e os que sabotam sua autoridade sem que você perceba. Pequenas mudanças de postura geram grandes mudanças de percepção.",
    ],
  },
  {
    slug: "comunicacao-magnetica",
    number: 4,
    title: "Comunicação Magnética",
    subtitle: "Menos insistência. Mais persuasão.",
    intro: "Existe uma diferença abissal entre comunicar e insistir.",
    paragraphs: [
      "A maioria das profissionais que luta para fechar clientes não tem um problema de visibilidade — tem um problema de mensagem. Elas falam muito sobre o que fazem e pouco sobre o que transformam.",
      "A comunicação magnética parte de um princípio simples: as pessoas não compram serviços, compram soluções. Quando você entende isso, sua comunicação deixa de ser um catálogo de técnicas e se torna um espelho de soluções que o cliente deseja.",
      "I. Fale sobre dores antes de falar sobre soluções: Quem se sente compreendido, confia. E quem confia, compra. Antes de apresentar o que você faz, mostre que você entende o que o cliente sente.",
      "II. Use linguagem de resultado, não de processo: Não é \"faço limpeza de pele profunda\". É \"sua pele vai parecer 5 anos mais jovem em 4 semanas\". Resultados vendem. Processos justificam.",
      "III. Elimine follow-ups desesperados: Um follow-up bem posicionado agrega valor (\"queria compartilhar algo que pode te ajudar\"). Um follow-up desesperado pede atenção (\"você viu minha mensagem?\"). A diferença está na intenção.",
    ],
    quote:
      "A persuasão magnética não força uma decisão. Ela cria clareza suficiente para que a decisão certa se torne óbvia.",
  },
  {
    slug: "autoridade-silenciosa",
    number: 5,
    title: "Autoridade Silenciosa",
    subtitle: "Como se tornar referência sem depender de hiperexposição.",
    freePreview: 0,
    intro:
      "O mundo digital criou um mito perigoso: o de que autoridade é proporcional à exposição. Mais posts, mais stories, mais reels — e sua agenda magicamente se preenche. Mas o que vemos na prática é diferente: profissionais com milhares de seguidores brigando por cada cliente, enquanto outras com audiências menores não dão conta da demanda.",
    paragraphs: [
      "A diferença não está no volume. Está na profundidade da autoridade construída. Autoridade silenciosa é aquela que não precisa ser proclamada porque já foi demonstrada — por resultados, por coerência, por consistência ao longo do tempo.",
      "Verdade incômoda: Hiperexposição sem substância cria seguidores. Autoridade com substância cria clientes. Você não precisa de mais visibilidade — você precisa que a visibilidade que você já tem converta melhor.",
      "Construir autoridade silenciosa envolve três movimentos: 1) Demonstrar domínio do seu campo através de conteúdo que educa e transforma; 2) Curar sua presença digital para que ela reflita exatamente quem você é e para quem você serve; 3) Colecionar e exibir evidências — depoimentos, resultados, transformações — que falem por você quando você não está presente.",
      "Autoridade silenciosa também significa saber o que não fazer: não participar de cada trend, não comentar sobre cada assunto, não estar disponível para todos o tempo todo. Escassez estratégica de presença, quando bem calibrada, aumenta o desejo.",
      "\"A referência não precisa se apresentar como referência. As pessoas ao redor fazem isso por ela.\"",
      "Experiência pessoal: Nunca fui a profissional que mais apareceu nas redes sociais. Nunca fui a profissional das trends. Nunca fui a profissional das dancinhas. Mesmo assim, minha agenda continuou crescendo. Foi quando percebi que \"autoridade\" não tem nada a ver com aparecer demais, fazer fotos e vídeos bem elaborados ou feed bonito. É sobre ser lembrada pelas razões certas. Ser lembrada por entregar o que o cliente precisa.",
    ],
  },
  {
    slug: "sistema-de-atracao",
    number: 6,
    title: "Sistema de Atração",
    subtitle: "Faça os clientes virem atrás de você.",
    freePreview: 0,
    intro:
      "Um sistema de atração não é uma sequência de posts ou uma campanha de anúncios. É uma estrutura intencional que funciona de forma semiautomática para criar, nutrir e converter interesse em clientes — com ou sem você presente em tempo real.",
    paragraphs: [
      "Profissionais que vivem apagando incêndio na captação de clientes geralmente operam no modo reativo: esperam o mês fechar mal para agir. O sistema de atração inverte essa lógica. Você age antes da escassez, constrói antes da necessidade urgente.",
      "Quando o cliente está aquecido, a oferta não parece venda. Parece o próximo passo óbvio de um serviço que ele mesmo escolheu. É neste momento que ocorre a conversão natural.",
    ],
    quote:
      "Um sistema de atração bem construído trabalha por você enquanto você dorme — ou enquanto você atende os clientes que ele já trouxe.",
  },
  {
    slug: "conversao-sem-esforco",
    number: 7,
    title: "Conversão sem Esforço",
    subtitle: "Quando vender deixa de parecer venda.",
    freePreview: 0,
    intro:
      "A maioria das profissionais que teme vender está, na verdade, temendo uma coisa específica: a rejeição que vem de uma oferta mal posicionada para a pessoa errada no momento errado. Quando o processo de atração funciona corretamente, a conversão se torna quase inevitável.",
    paragraphs: [
      "Conversão sem esforço não significa conversão sem intenção. Significa que a venda acontece como consequência natural de um relacionamento bem construído, não como um momento de pressão e convencimento.",
      "A consulta de venda magnética — seja uma conversa, um direct, ou uma página de vendas — segue uma sequência: 1) Reconhecimento da dor; 2) Apresentação da transformação; 3) Demonstração de credibilidade; 4) Convite à ação.",
      "Essa sequência não manipula. Ela clarifica.",
      "\"A venda mais poderosa é aquela em que o cliente diz: 'Era exatamente isso que eu precisava'. Seu trabalho é criar as condições para que ele chegue a essa conclusão.\"",
    ],
  },
  {
    slug: "retencao-e-indicacao",
    number: 8,
    title: "Retenção e Indicação",
    subtitle: "Transformando clientes em promotores.",
    freePreview: 0,
    intro:
      "Atrair um cliente é o começo, não o objetivo. O objetivo é que esse cliente volte, compre mais e traga outros. Essa é a diferença entre um negócio que vive de promoções urgentes e um negócio que cresce de forma orgânica e sustentável.",
    paragraphs: [
      "A retenção começa antes do cliente pagar. Começa na clareza das expectativas, na qualidade da experiência de compra, no cuidado com o onboarding — os primeiros momentos após a decisão de contratar. Uma experiência inicial extraordinária cria o cliente fiel antes do serviço ser entregue.",
      "I. Supere as expectativas nos detalhes: Não é necessário fazer mais do que prometeu. É necessário fazer o que prometeu com um nível de cuidado que o cliente não esperava. O detalhe surpreende mais do que o volume.",
      "II. Crie rituais de reconhecimento: Lembre datas, celebre resultados do cliente, agradeça de forma personalizada. Clientes que se sentem vistos como pessoas — não como números — voltam e indicam.",
      "Clientes satisfeitos são seu melhor canal de atração. Crie rituais de pós-atendimento que tornam a indicação natural, não forçada.",
      "\"Seu melhor marketing não está no que você posta. Está no que seus clientes falam sobre você quando você não está presente.\"",
      "Experiência pessoal: Muitos dos meus pacientes não vieram através de anúncios. Vieram através de outros pacientes. E isso me ensinou uma lição importante: o melhor marketing nem sempre é o que você publica. Muitas vezes é a experiência que você entrega dentro do consultório.",
    ],
  },
  {
    slug: "a-agenda-magnetica",
    number: 9,
    title: "A Agenda Magnética",
    subtitle: "Não é sobre ter uma agenda lotada. É sobre ter uma Agenda Magnética.",
    freePreview: 0,
    intro:
      "Chegamos ao ponto central de tudo. Uma agenda lotada com os clientes errados esgota. Uma agenda magnética energiza. A diferença não está na quantidade — está na qualidade da escolha de com quem você trabalha e em como eles chegam até você.",
    paragraphs: [
      "Uma Agenda Magnética é formada por clientes que chegaram qualificados, que reconhecem o valor do seu trabalho, que pagam sem resistência e que recomendam sem ser pedidos. Esses clientes existem. A questão é se você construiu as condições para que eles te encontrem.",
      "Ao longo deste manual, você percorreu os 9 pilares que tornam isso possível. Não são atalhos. São fundamentos. E fundamentos levam tempo para se solidificar — mas quando se solidificam, criam algo que nenhuma campanha de anúncios consegue reproduzir: autoridade genuína e atração sustentável.",
      "Durante anos ouvi que o objetivo era ter agenda lotada. Hoje penso diferente. Eu não quero atender o maior número possível de pessoas. Quero atender as pessoas certas. Com calma. Sem pressa. Com qualidade. E construir uma rotina que me permita crescer sem abrir mão da minha vida.",
      "Agenda lotada é diferente de agenda fechada.",
      "\"Uma agenda lotada com os clientes errados esgota. Uma agenda magnética fechada energiza.\"",
      "A Agenda Magnética não é o fim da jornada. É a prova de que você construiu algo real — um negócio que atrai porque tem valor, e tem valor porque foi construído com intenção.",
    ],
  },
];

MODULES.push({
  slug: "manifesto-agenda-magnetica",
  number: 10,
  title: "Bônus — Manifesto Agenda Magnética",
  subtitle: "Repita isso diariamente.",
  freePreview: 0,
  intro:
    "Um manifesto não é uma regra. É uma escolha diária. Estes são os princípios que sustentam a Agenda Magnética — leia como quem assina embaixo.",
  paragraphs: [
    "1. Eu não preciso parecer o tempo todo para ser lembrado. Preciso aparecer com intenção.",
    "2. Minha agenda não depende de danças, trends ou hiperexposição.",
    "3. Meu posicionamento é coerente com o que eu penso, falo e faço.",
    "4. Eu não corro atrás de clientes, eu construo condições para que eles me encontrem.",
    "5. Os clientes certos para mim me procuram, os errados se afastam.",
    "6. Eu não imploro atenção, eu construo valor.",
    "7. Eu não busco curtidas. Eu busco confiança.",
    "8. Eu não quero uma agenda lotada. Eu quero uma Agenda Magnética.",
  ],
});

export const getModule = (slug: string) => MODULES.find((m) => m.slug === slug);
export const getModuleIndex = (slug: string) => MODULES.findIndex((m) => m.slug === slug);
