"use strict";

/* ==========================================================
   PERÍCIAS DE ATRIBUTO E PERÍCIAS DE MAESTRIA — DADOS
   Os textos das descrições estão copiados exatamente das regras:
   não resuma, reescreva nem traduza. Cada Perícia tem:
     desc    → parágrafos (texto livre)
     bullets → itens com marcadores
     req     → requisitos aplicados de verdade na lógica (script.js)
   Tipos de requisito:
     { k: "trained", skill }           treinada (nível 1 ou mais)
     { k: "level", skill, lv }         nível de treino mínimo
     { k: "attr", attr, min, label }   valor mínimo de um atributo
     { k: "any", opts: [...], label }  basta cumprir uma das opções
     { k: "knownLutas", n }            conhece N Perícias de Luta
     { k: "notOwned", id, label }      incompatível com outra Perícia
     { k: "noMaestriaLuta" }           não pode ser usada com Lutas de Maestria
   ========================================================== */

const HAB_COST = { atributo: 2, maestria: 3 };
const MMA_EXTRA_COST = 3;
const MMA_BASE_SLOTS = 2;
const MMA_EXTRA_SLOTS = 1;
const MMA_CAP_DIE = 2;     // vantagens que aumentam dado de dano: no máximo 2
const MMA_CAP_LEVEL = 2;   // vantagens que aumentam nível de dano: no máximo 2

const HAB_GROUPS = [
  { id: "atributo-corpo",   tipo: "atributo", attr: "corpo",   title: "Perícias de Atributo: Corpo",   category: "Perícia de Luta" },
  { id: "maestria-corpo",   tipo: "maestria", attr: "corpo",   title: "Perícias de Maestria: Corpo",   category: "Lutas de Maestria" },
  { id: "atributo-mente",   tipo: "atributo", attr: "mente",   title: "Perícias de Atributo: Mente",   category: "Perícias de Teoria" },
  { id: "maestria-mente",   tipo: "maestria", attr: "mente",   title: "Perícias de Maestria: Mente",   category: "Maestrias Mentais" },
  { id: "atributo-persona", tipo: "atributo", attr: "persona", title: "Perícias de Atributo: Persona", category: "Perícias de Carisma" },
  // Persona NÃO tem Perícias de Maestria: nenhum grupo é criado para ela.
];

/* Em `mma`: { b: n } usa o item n de `bullets` sem alteração; { t: "..." } é um
   trecho do mesmo item, separado em vantagem e desvantagem (itens que misturam os dois).
   die / lvl: a vantagem aumenta o dado / o nível de dano (limite de 2 de cada no MMA). */
const HABS = [
  /* ---------- Perícias de Atributo: Corpo — Perícia de Luta ---------- */
  {
    id: "muay-thai", group: "atributo-corpo", name: "Muay Thai", req: [],
    desc: ["O Muay Thai é uma modalidade de combate que utiliza um sistema de oito pontos de contato, sendo eles: Punhos, cotovelos, joelhos e pernas. Em confrontos próximos, é extremamente perigoso."],
    bullets: [
      "Seus ataques corpo-a-corpo passam a ser considerados armas letais.",
      "Se estiver adjacente a um oponente, pode realizar um teste de Reflexos oposto para impedir uma ação dele. (Como recarregar uma arma, puxar algo do inventário e etc.)",
      "Possui desvantagens para resistir a manobras.",
    ],
    mma: { adv: [{ b: 0 }, { b: 1 }], dis: [{ b: 2 }] },
  },
  {
    id: "jiu-jitsu", group: "atributo-corpo", name: "Jiu-Jitsu",
    req: [{ k: "trained", skill: "precisao" }],
    desc: ["A modalidade do Jiu-Jitsu se concentra em dominar adversários através de agarrões e técnicas de submissão. Sua eficácia aumenta de forma considerável quando o praticante estabelece controle prático sobre o oponente."],
    bullets: [
      "Possui vantagens ao realizar manobras.",
      "Aumenta o dado de dano em 1 contra oponentes agarrados/imobilizados.",
      "Ao evitar um ataque corpo-a-corpo, pode realizar um teste de Reflexos oposto para tentar agarrar o inimigo.",
      "Contra oponentes que não estejam agarrados, possui desvantagem.",
      "Enquanto estiver de pé ou o seu oponente não estiver agarrado, reduz sua Defesa em 1.",
    ],
    mma: { adv: [{ b: 0 }, { b: 1, die: 1 }, { b: 2 }], dis: [{ b: 3 }, { b: 4 }] },
  },
  {
    id: "boxe", group: "atributo-corpo", name: "Boxe", req: [],
    desc: ["A modalidade do Boxe se concentra na utilização quase exclusiva dos punhos, também da movimentação defensiva e exploração da abertura dos alvos. Seus praticantes conseguem identificar oportunidades para contra-atacar sem se comprometer."],
    bullets: [
      "Aumenta 1 dado de dano de ataques desarmados.",
      "Aumenta a esquiva do praticante em 2, e reduz sua Defesa em 2.",
      "Possui vantagem em contra ataques, contanto que sejam desarmados.",
      "Uma vez por rodada, pode sacrificar sua Ação Padrão para aumentar sua esquiva em 2 na próxima rodada.",
    ],
    mma: {
      adv: [{ b: 0, die: 1 }, { t: "Aumenta a esquiva do praticante em 2." }, { b: 2 }, { b: 3 }],
      dis: [{ t: "Reduz sua Defesa em 2." }],
    },
  },
  {
    id: "kung-fu", group: "atributo-corpo", name: "Kung Fu", req: [],
    desc: ["O Kung Fu é uma modalidade que engloba diversas tradições marciais chinesas, sendo uma esbelta mistura e demonstração de sua cultura. Seus movimentos coordenados exploram técnicas de defesa e ataques envolvendo o equilíbrio corporal e a movimentação do adversário."],
    bullets: [
      "Aumenta a Defesa em 2 e reduz a Esquiva em 1.",
      "Aumenta o dano desarmado em 1 dado.",
      "Possui vantagem ao resistir tentativas de desarme e manobras de imobilização.",
      "Pode usar uma manobra defensiva para impor uma desvantagem no próximo ataque do alvo caso ele erre um ataque contra você.",
    ],
    mma: {
      adv: [{ t: "Aumenta a Defesa em 2." }, { b: 1, die: 1 }, { b: 2 }, { b: 3 }],
      dis: [{ t: "Reduz a Esquiva em 1." }],
    },
  },
  {
    id: "capoeira-angolana", group: "atributo-corpo", name: "Capoeira Angolana",
    req: [{ k: "level", skill: "violencia", lv: 2 }],
    desc: ["Uma versão mais brutal e “suja” da capoeira regional, focada em golpes baixos e eficazes, mas ainda mantendo a malandragem de sua vertente regional."],
    bullets: [
      "Aumenta um dado de dano desarmado.",
      "Ao acertar um golpe crítico, tem 20% de chance de deslocar um osso do oponente, deixando-o Lento por Corpo turnos e atordoado por 1.",
      "Reduzindo seu dano pela metade, pode aumentar a chance de atordoar um oponente para 50%. (Par ou ímpar em 1d10)",
      "Aumenta a Esquiva e a Defesa em 1.",
      "Por 5 PA, você pode reduzir o dano de um ataque corpo-a-corpo pela metade ao ter sucesso em um teste de Fortitude DT 5.",
    ],
    mma: { adv: [{ b: 0, die: 1 }, { b: 1 }, { b: 2 }, { b: 3 }, { b: 4 }], dis: [] },
  },
  {
    id: "capoeira-regional", group: "atributo-corpo", name: "Capoeira Regional",
    req: [{ k: "trained", skill: "acrobacia" }],
    desc: ["A vertente da capoeira mais conhecida no Brasil, focada em movimentos imprevisíveis, rápidos e que acertam como uma marreta. Os praticantes dessa arte marcial utilizam movimentos bruscos para confundir o oponente e criar aberturas."],
    bullets: [
      "Aumenta um dado de dano desarmado.",
      "Ao acertar um golpe crítico, tem 30% de chance de deixar um inimigo atordoado por 1 turno.",
      "Aumenta a Esquiva do praticante em 2.",
      "Ao esquivar/defender um ataque, você pode se deslocar até metade do seu movimento em qualquer direção, somente uma vez por rodada.",
      "Possui vantagem para resistir contra empurrões, desarmes ou tentativas de derrubada. Não acumula com outras vantagens.",
    ],
    mma: { adv: [{ b: 0, die: 1 }, { b: 1 }, { b: 2 }, { b: 3 }, { b: 4 }], dis: [] },
  },
  {
    id: "kick-boxing", group: "atributo-corpo", name: "Kick-boxing",
    req: [{ k: "level", skill: "violencia", lv: 2 }],
    desc: ["Uma modalidade que combina técnicas de boxe com chutes, priorizando ataques contínuos, combinações e muita pressão sob o adversário. Seus praticantes conseguem sobrecarregar o oponente através de golpes consecutivos e força avassaladora."],
    bullets: [
      "Aumenta o nível de dano em 1, e após 3 golpes consecutivos, aumenta o dado de dano em 1, também, caso os golpes acertem.",
      "Ataques críticos possuem 5% (20 em d20) de chance de nocautear o adversário.",
      "Reduz a Esquiva em 2 e a Defesa em 1, porém adiciona RD igual a Corpo.",
    ],
    mma: {
      adv: [{ b: 0, die: 1, lvl: 1 }, { b: 1 }, { t: "Adiciona RD igual a Corpo." }],
      dis: [{ t: "Reduz a Esquiva em 2 e a Defesa em 1." }],
    },
  },

  /* ---------- Perícias de Maestria: Corpo — Lutas de Maestria ---------- */
  {
    id: "krav-maga", group: "maestria-corpo", name: "Krav Maga",
    req: [
      { k: "trained", skill: "sobrevivencia" },
      { k: "level", skill: "violencia", lv: 2 },
      { k: "notOwned", id: "mma", label: "Não pode ser usada junto com MMA" },
    ],
    desc: ["Esse sistema de combate prioriza a neutralização rápida de ameaças, utilizando de técnicas agressivas que exploram vulnerabilidades e buscam encerrar confrontos de forma eficaz e agressiva."],
    bullets: [
      "Aumenta 1 dado de dano desarmado e 2 níveis.",
      "Possui vantagem ao realizar manobras ofensivas, desarmes e qualquer tentativa de incapacitação.",
      "Ao atacar um oponente que já tenha recebido dano, recebe uma vantagem por 1d4 turnos.",
      "Caso um oponente tente agarrá-lo, pode realizar um contra-ataque.",
      "Reduz a Esquiva em 2 e aumenta a Defesa em 1.",
    ],
  },
  {
    id: "sanda", group: "maestria-corpo", name: "Sanda",
    req: [
      { k: "trained", skill: "precisao" },
      { k: "level", skill: "violencia", lv: 2 },
      { k: "notOwned", id: "mma", label: "Não pode ser usada junto com MMA" },
    ],
    desc: ["Combinando técnicas de golpe, projeções e queda, os praticantes de Sanda utilizam ataques para desequilibrar e controlar a posição do oponente. Seus praticantes são capazes de alternar entre ataques diretos e manobras de controle."],
    bullets: [
      "Recebe RD 5 contra ataques corpo-a-corpo e 2 contra outros ataques.",
      "Aumenta o dano desarmado em 1 dado e 1 nível.",
      "Ao esquivar ou defender um ataque, você consegue realizar uma técnica de projeção ou de queda, deixando o adversário caído por 1d4 turnos caso ele falhe em um teste de Reflexos oposto.",
      "Possui desvantagem ao resistir a manobras de imobilização.",
    ],
  },
  {
    id: "mma", group: "maestria-corpo", name: "MMA", special: "mma",
    req: [
      { k: "knownLutas", n: 4 },
      { k: "noMaestriaLuta" },
    ],
    desc: [
      "Você pode escolher 2 vantagens de outras lutas que conheça, porém, deve escolher também 2 desvantagens. Não pode ser usado com Lutas de Maestria.",
      "Ao gastar 3 pontos de perícia adicionais, pode escolher mais uma vantagem e desvantagem.",
      "Vantagens que aumentem nível ou dado de dano só acumulam até 2 de cada.",
    ],
    bullets: [],
  },

  /* ---------- Perícias de Atributo: Mente — Perícias de Teoria ---------- */
  {
    id: "deducao", group: "atributo-mente", name: "Dedução",
    req: [{ k: "attr", attr: "persona", min: 1, label: "1 ponto em Persona" }],
    desc: ["Você consegue analisar a cena para garantir vantagem em um atributo e desvantagem em outro, sacrificando certa parte de sua estratégia para ampliar outra e sair no topo. Pode comunicar para os seus aliados para garantir a mesma vantagem."],
    bullets: [],
  },
  {
    id: "raciocinio-rapido", group: "atributo-mente", name: "Raciocínio Rápido",
    req: [{ k: "trained", skill: "reflexos" }],
    desc: [
      "Seu cérebro é acelerado, e o mundo em torno de você se torna slow-mo por alguns segundos, como se você estivesse em um filme de ação.",
      "Uma vez por cena, você pode reduzir a execução de uma rolagem de Mente em um.",
    ],
    bullets: [],
  },
  {
    id: "historia", group: "atributo-mente", name: "História", req: [],
    desc: ["Você obteve diversos conhecimentos sobre história, através de livros ou arquivos online antes da internet sumir, se tornado sua própria biblioteca. Uma vez por cena, você pode realizar um teste de Percepção/Investigação para saber se já viu algo parecido antes e receber uma pista."],
    bullets: [],
  },
  {
    id: "simulacao", group: "atributo-mente", name: "Simulação",
    req: [{ k: "trained", skill: "tatica" }],
    desc: ["A sua mente roda a milhão. Você consegue simular cenários e prever como as coisas irão se sair, como se fosse uma máquina. Uma vez por cena, você pode realizar um teste de Tática para simular a situação atual e, caso tenha sucesso, recebe vantagem no próximo ataque."],
    bullets: [],
  },
  {
    id: "moldar-cognicao", group: "atributo-mente", name: "Moldar Cognição",
    req: [{ k: "attr", attr: "mente", min: 2, label: "Mente 2 ou mais" }],
    desc: ["Sua mente é mais resistente que a dos outros, se tornando uma fortaleza (quase) impenetrável. Uma quantidade de vezes igual a seu nível em Mente dividido por 2, você pode negar um dano de integridade."],
    bullets: [],
  },
  {
    id: "mapeamento-emocional", group: "atributo-mente", name: "Mapeamento Emocional",
    req: [{ k: "attr", attr: "persona", min: 1, label: "1 ponto em Persona" }],
    desc: ["Mapeando as emoções das pessoas, você consegue descobrir e desvendar mistérios sobre elas. Uma quantidade de vezes por cena igual ao seu nível de Persona + Mente você pode rolar um dado e, caso tenha sucesso, uma pista sobre o alvo será revelada para você com base no que você consegue observar sobre seus maneirismos e comportamento."],
    bullets: [],
  },

  /* ---------- Perícias de Maestria: Mente — Maestrias Mentais ---------- */
  {
    id: "mente-inabalavel", group: "maestria-mente", name: "Mente Inabalável", req: [],
    desc: ["Você ganha vantagem para resistir efeitos mentais e se torna imune a efeitos causados por alvos que tenham 2 níveis de Mente abaixo do seu. Você, também, consegue suprir suas emoções e ignorar uma condição de Insanidade uma vez por cena, mas a próxima cura de Integridade que receber é cortada pela metade."],
    bullets: [],
  },
  {
    id: "estado-de-calmaria", group: "maestria-mente", name: "Estado de Calmaria",
    req: [
      { k: "any", label: "Treinamento em Fortitude ou Espírito (Espírito 1 ou mais)",
        opts: [{ k: "trained", skill: "fortitude" }, { k: "attr", attr: "espirito", min: 1 }] },
      { k: "any", label: "Treinamento em Reflexos ou Tática",
        opts: [{ k: "trained", skill: "reflexos" }, { k: "trained", skill: "tatica" }] },
      { k: "attr", attr: "mente", min: 3, label: "Mente 3 ou mais" },
    ],
    desc: [
      "Uma vez por cena, você pode entrar em um estado de calmaria mental absoluta. O que significa que você ganha vantagem em todos os testes de ataque e defesa (caso tenha) e pode ignorar testes opostos que causariam condições mentais. Se torna imune a condições de Insanidade enquanto estiver com este modo ativo. 1d6 para decidir quantos turnos ficará com esse modo. Após esse estado acabar, você realiza um teste de Espírito. Em uma falha, recebe 1d10 dano de Integridade, ignorando insanidade.",
    ],
    bullets: [],
  },
  {
    id: "controle-de-narrativa", group: "maestria-mente", name: "Controle de Narrativa", req: [],
    desc: ["Você se conta uma mentira tantas vezes que ela se torna verdade para você. Recebe 2 vantagens em testes que envolvem mentir e enganar. Uma vez por cena, você pode ter sucesso imediato em um teste mencionado acima, porém, você acredita fielmente na mentira e recebe 1d4 dano de Integridade. Ser um mentiroso sujo não é algo bom. Pelo menos, não costumava ser."],
    bullets: [],
  },

  /* ---------- Perícias de Atributo: Persona — Perícias de Carisma ---------- */
  {
    id: "leitura-de-microexpressoes", group: "atributo-persona", name: "Leitura de Microexpressões",
    req: [{ k: "attr", attr: "persona", min: 2, label: "Persona 2 ou mais" }],
    desc: [
      "Você consegue perceber pequenas movimentações nos músculos faciais das pessoas, e consegue deduzir o que elas estão sentindo de forma razoavelmente precisa, através de estudos sobre padrões comportamentais que você já teve.",
      "Ganha vantagens em testes de Intuição e Influência (em certas ocasiões) e +1 em duas perícias de Persona de sua escolha.",
    ],
    bullets: [],
  },
  {
    id: "pressao-espiritual", group: "atributo-persona", name: "Pressão Espiritual",
    req: [{ k: "attr", attr: "mente", min: 1, label: "Mente 1 ou mais" }],
    desc: [
      "Você consegue pressionar um alvo, seja através de sua reputação tenebrosa ou simplesmente pela sua postura intimidante ou bizarra, fazendo qualquer um tremer de pavor contra você.",
      "Você realiza um teste de Intimidação contra o alvo, caso tenha sucesso, ele revelará uma pista relevante para a situação de vocês. Só pode ser usado em certas situações.",
    ],
    bullets: [],
  },
  {
    id: "exploracao-mental", group: "atributo-persona", name: "Exploração Mental", req: [],
    desc: ["Com seus conhecimentos, você consegue manipular alvos com uma maestria assustadora. Você pode realizar um teste de Persuasão e, caso tenha sucesso, o alvo aumenta 1 nível de relação automaticamente. Não pode aumentar de aliado para leal, nem de rival para desprezo. O alvo começa a te perceber e te enxergar de uma forma melhor, seja por um pequeno gesto, como entregar uma lata extra de comida ou garrafa d'água, ou por incluir ele em uma conversa ou situação social."],
    bullets: [],
  },
  {
    id: "presenca-inofensiva", group: "atributo-persona", name: "Presença Inofensiva",
    req: [{ k: "trained", skill: "influencia" }],
    desc: ["Suprimindo sua presença, você se torna alguém mais “inofensivo”, se portando como indefeso ou simplesmente alguém que não apresenta nenhuma ameaça. Você ganha vantagem em testes de Iniciativa quando o combate se inicia de forma “surpresa”. Você também ganha vantagem em testes de Influência que envolvem enganar."],
    bullets: [],
  },
  {
    id: "presenca-ofensiva", group: "atributo-persona", name: "Presença Ofensiva",
    req: [{ k: "trained", skill: "influencia" }],
    desc: ["Se impondo às pessoas ao seu redor, você se torna uma figura mais intimidante e imponente, se portando como alguém que deve ser temido, como alguém que está presente somente para machucar. Você ganha vantagem em testes de Iniciativa quando o combate se inicia de forma esperada e vantagem em testes de Influência que envolvem intimidação."],
    bullets: [],
  },
  {
    id: "hierarquia-calibrada", group: "atributo-persona", name: "Hierarquia Calibrada",
    req: [{ k: "trained", skill: "influencia" }],
    desc: ["Realizando um teste de Influência e tendo um sucesso, todos os NPCs da cena estão suscetíveis a te seguir e seguir seus comandos. Narrativamente, você pode ter feito isso por intimidação ou por persuasão. Sendo ou um tirano maligno, intimidante e brutal, ou uma pessoa alegre e fácil de conversar, você consegue convencer os outros a te seguir."],
    bullets: [],
  },
  {
    id: "little-star", group: "atributo-persona", name: "Little Star", req: [],
    desc: ["Uma boa comunicação é invejada por muitos, mas uma péssima comunicação é odiada por todos. Com uma habilidade e talento impressionante para encher linguiça e manter uma conversa viva por fios, você enche a mente do alvo de informações inúteis e conversas sem nexo e consegue causar uma desvantagem em uma perícia comum qualquer. Efetividade depende da interpretação."],
    bullets: [],
  },
  {
    id: "eu-conheco-um-cara", group: "atributo-persona", name: "Eu Conheço um Cara", req: [],
    desc: ["No tempo que você esteve vivo, durante ou antes do Apocalipse, você fez muitos amigos (e inimigos). De qualquer forma, você ainda sim fez muitas conexões. Uma vez por missão, você pode contatar uma das suas conexões e receber um auxílio. Depende da situação."],
    bullets: [],
  },
];
