"use strict";

/* ==========================================================
   REGRAS DO SISTEMA
   ========================================================== */

// Não há limite de pontos: os atributos podem subir sem teto.
const ATTRS = ["corpo", "mente", "persona", "espirito"];

// Cada estatística derivada recebe os atributos { corpo, mente, persona, espirito }
const DERIVED = {
  defesa:  a => Math.ceil(2 + a.corpo * 1.5),
  esquiva: a => Math.ceil(2 + a.mente * 2),
  pv:      a => 14 + a.corpo * 6,
  pa:      a => a.corpo * 12,
  ve:      a => 2 + a.mente * 2,
  desloc:  a => 5 + a.corpo * 1.5, // em metros
};

// Mapeia cada estatística ao elemento que mostra o valor
const OUTPUT_IDS = {
  defesa: "out-defesa",
  esquiva: "out-esquiva",
  pv: "out-pv",
  pa: "out-pa",
  ve: "out-ve",
  desloc: "out-desloc",
};

/* DOM */

const attrs = { corpo: 0, mente: 0, persona: 0, espirito: 0 };

const el = id => document.getElementById(id);
const sum = () => ATTRS.reduce((s, k) => s + attrs[k], 0);

const fmt = n => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Escapa texto vindo do usuário (nomes, importações) antes de usar em innerHTML
const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function pulse(node) {
  node.classList.remove("pulse");
  void node.offsetWidth; // reinicia a animação
  node.classList.add("pulse");
}

function setText(node, text) {
  if (node.textContent !== text) {
    node.textContent = text;
    pulse(node);
  }
}

function render() {
  // Atributos e botões (só o "−" trava, em 0)
  for (const k of ATTRS) {
    setText(el("val-" + k), String(attrs[k]));
    document.querySelector(`.step[data-attr="${k}"][data-dir="-1"]`).disabled = attrs[k] <= 0;
  }

  // Total de pontos distribuídos
  setText(el("pointsSpent"), String(sum()));

  // Estatísticas derivadas
  for (const key of Object.keys(DERIVED)) {
    setText(el(OUTPUT_IDS[key]), fmt(DERIVED[key](attrs)));
  }

  // Perícias, Espírito e Dado de Dano dependem dos atributos
  renderSkills();
}

function change(attr, dir) {
  const next = attrs[attr] + dir;
  if (next < 0) return;
  applyAttrChange(attr, next);   // ao diminuir, remove pontos e treino (LIFO)
  touch();
  render();
}

function resetAttributes() {
  ATTRS.forEach(k => applyAttrChange(k, 0));
  touch();
  render();
}

document.querySelectorAll(".attr .step").forEach(btn => {
  btn.addEventListener("click", () => change(btn.dataset.attr, Number(btn.dataset.dir)));
});

el("reset").addEventListener("click", () => {
  const spent = CATEGORIES.reduce((t, c) => t + spentPoints(c), 0);
  openModal({
    title: "Redefinir atributos?",
    body: `
      <p><strong>Atenção:</strong> seus Atributos e Perícias serão redefinidos.</p>
      <p>Agora você tem ${sum()} ponto(s) distribuído(s) em atributos e ${spent} Ponto(s) de Perícia investido(s) em treino.</p>
      <ul>
        <li>Corpo, Mente, Persona e Espírito voltam a 0.</li>
        <li>Cada atributo gera seus próprios Pontos de Perícia, então todo o treino comprado com eles é removido, das compras mais recentes para as mais antigas.</li>
        <li>Perícias de Atributo e de Maestria compradas também saem (das mais recentes para as mais antigas), pois usam esses mesmos pontos.</li>
        <li>Perícias gratuitas, contadores de Vantagem e opções de Espírito não mudam.</li>
      </ul>
      <p>Esta ação não pode ser desfeita.</p>`,
    okLabel: "Confirmar",
    seconds: 5,
    danger: true,
    onConfirm: resetAttributes,
  });
});

/* ==========================================================
   PERÍCIAS
   ========================================================== */

const MAX_LEVEL = 5;          // nível máximo de treino
const TABLE_MAX = 5;          // maior valor de atributo coberto pelas tabelas de pontos
const SKILL_STORE = "rpg-ficha-pericias";
const RES_ESPIRITO = "res-espirito";   // teste de resistência de Espírito
const THEMES = ["corpo", "mente", "persona", "espirito"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-");
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const rollDie = sides => 1 + Math.floor(Math.random() * sides);
const rand = (a, b) => a + Math.random() * (b - a);

/* `gains[n - 1]` = Pontos de Perícia ganhos ao chegar ao valor n do atributo.
   Os ganhos se acumulam (Corpo 3 = 4 + 4 + 5 = 13 pontos).
   `free` = perícias gratuitas (escolhidas pelo jogador, começam treinadas). */
const CATEGORIES = [
  {
    id: "corpo", name: "Corpo", free: 2, gains: [4, 4, 5, 5, 5],
    skills: ["Atletismo", "Acrobacia", "Luta Improvisada", "Levantamento", "Furtividade",
             "Fortitude", "Precisão", "Violência", "Iniciativa"],
  },
  {
    id: "mente", name: "Mente", free: 3, gains: [4, 5, 5, 6, 6],
    skills: ["Atualidades", "Ciências", "Pilotagem", "Percepção", "Investigação", "Medicina",
             "Tecnologia", "Sobrevivência", "Reflexos", "Tática", "Conhecimentos Ocultos", "Pontaria"],
  },
  {
    id: "persona", name: "Persona", free: 2, gains: [4, 3, 6, 3, 0],
    skills: ["Influência", "Intuição", "Adestramento", "Performance", "Crime"],
  },
];

const SKILLS = {};   // id -> { id, name, cat }
CATEGORIES.forEach(c => {
  c.ids = c.skills.map(name => {
    const id = slug(name);
    SKILLS[id] = { id, name, cat: c.id };
    return id;
  });
});

const ABILITIES = [
  {
    id: "odio", name: "Ódio Incontrolável",
    paras: ["Quando entrar em morrendo, você não cai. Ao invés disso, você entra em um estado de fúria incontrolável e incessante. Uma vez por turno, obrigatoriamente, você deve causar dano a um ser, seja um aliado ou um inimigo. Quando o combate acabar, você cai no chão, morrendo de verdade dessa vez, e deve ser salvo em uma quantidade de turnos igual seu valor em Espírito. Essa habilidade tem uma duração igual a d4 + Espírito de turnos durante o combate."],
  },
  {
    id: "controle", name: "Controle Corporal",
    paras: ["Após cair no chão em morrendo, você consegue realizar um teste de Fortitude/Espírito para agir uma vez no seu turno. Diferente de Ódio Incontrolável, você pode realizar quais ações desejar após ter sucesso no dado. O DT do teste é 4 + (Espírito x 1.5) e diminui em 1 a cada 2 turnos, caso você tenha sucesso. Ao falhar, a DT aumenta em 1."],
  },
  {
    id: "quem", name: "Quem decidiu isso?",
    paras: ["Ao entrar em morrendo, você consegue recuperar 2d4 + Espírito/Fortitude PVs e remover a condição de Morrendo. Você se recusa a morrer tão cedo, e seu corpo continua funcionando. Claro, isso só se aplica se você ainda tiver um corpo. Funciona uma vez por sessão."],
  },
  {
    id: "mania", name: "Mania",
    paras: ["Uma vez por cena, você consegue soltar uma quantidade de adrenalina no seu corpo capaz de matar alguém. Mas, você está acostumado a isso. Os seguintes efeitos se aplicam a você por 1d4 + Espírito turnos."],
    list: ["Vantagem em testes de Corpo", "Imunidade aos efeitos de Enjoado, Tonto e Fraco.", "+2m de Deslocamento."],
  },
  {
    id: "alem", name: "Além da Dor",
    paras: [
      "Ao estar ferido gravemente, você pode escolher ignorar os efeitos do mesmo. Sangramentos, desmembramentos, desmaios e etc. por uma quantidade de turnos igual a Espírito x 2. Você só consegue ignorar os efeitos se a habilidade for ativada antes deles acontecerem, no caso de desmaios e nocautes. Em desmembramentos e outros efeitos similares, você ignora o dano de condições até a habilidade acabar.",
      "Porém, os efeitos retornam quando os turnos acabarem. Além disso, todo dano que você teria recebido, que não provém de ataques, são reduzidos pela metade quando Além da Dor acabar.",
    ],
  },
  {
    id: "forca", name: "Força Mental",
    paras: ["Você recebe vantagem em testes contra tentativas de influenciar você, seja através de controle mental, manipulação social ou controle de implantes cerebrais através de ondas eletromagnéticas. Além disso, pode ter um sucesso por cena em testes de resistência mental."],
  },
];

/* ---------- Estado ---------- */

const pState = {
  skills: {},   // id -> { lv, adv, free }
  esp: { resist: false, advSkill: null, ability: null },
};
[...Object.keys(SKILLS), RES_ESPIRITO].forEach(id => {
  pState.skills[id] = { lv: 0, adv: 0, free: false };
});

// Histórico de compras por categoria (ids de perícia, da mais antiga para a mais recente).
// Cada entrada é um nível pago; serve para remover treino em ordem LIFO.
const hist = { corpo: [], mente: [], persona: [] };
// Último aviso de redução de atributo por categoria (só em memória).
const affected = { corpo: null, mente: null, persona: null };

let skillsBuilt = false;

const catOf = id => (has(SKILLS, id) ? CATEGORIES.find(c => c.id === SKILLS[id].cat) : null);
const catTotal = (c, a) => c.gains.slice(0, Math.min(a[c.id], TABLE_MAX)).reduce((s, g) => s + g, 0);
// Nível 1 custa 1 ponto (0 se for gratuita); cada nível seguinte custa 2.
const skillCost = s => (s.lv <= 0 ? 0 : (s.free ? 0 : 1) + 2 * (s.lv - 1));
const catSpent = (c, skills, abil = pAbil) => c.ids.reduce((t, id) => t + skillCost(skills[id]), 0) + abilSpent(c, abil);
const totalPoints = c => catTotal(c, attrs);
const spentPoints = c => catSpent(c, pState.skills);
const freeUsed = c => c.ids.filter(id => pState.skills[id].free).length;
const bonusOf = id => (id === RES_ESPIRITO ? attrs.espirito : pState.skills[id].lv);

function advSources(id) {
  const out = [];
  if (pState.skills[id].adv > 0) out.push("contador");
  if (pState.esp.resist && (id === "fortitude" || id === RES_ESPIRITO)) out.push("Espírito: resistência");
  if (pState.esp.advSkill === id) out.push("Espírito: perícia escolhida");
  return out;
}

function canUpgrade(c, id) {
  const s = pState.skills[id];
  if (s.lv >= MAX_LEVEL) return false;
  const left = totalPoints(c) - spentPoints(c);
  if (left < 0) return false;                    // alocação inválida: bloqueia melhorias
  return left >= (s.lv === 0 ? 1 : 2);
}

const catById = id => CATEGORIES.find(c => c.id === id) || null;

function removeFirst(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); }
function removeLast(arr, v) { const i = arr.lastIndexOf(v); if (i >= 0) arr.splice(i, 1); }

/* Remove, da compra mais recente para a mais antiga (LIFO), apenas o treino
   que deixou de caber no orçamento da categoria. Retorna as perícias afetadas. */
function enforceBudget(c) {
  const total = totalPoints(c);
  const h = hist[c.id];
  const hit = new Map();
  while (spentPoints(c) > total && h.length) {
    const id = h.pop();
    if (id.startsWith(HAB_TOKEN)) { undoHabToken(id, hit); continue; }   // Perícia de Atributo/Maestria
    const s = pState.skills[id];
    if (!s || s.lv <= 0) continue;               // entrada órfã (defensivo)
    if (!hit.has(id)) hit.set(id, { id, name: SKILLS[id].name, from: s.lv, to: s.lv });
    s.lv -= 1;
    hit.get(id).to = s.lv;
    if (s.lv === 0) s.free = false;
  }
  return [...hit.values()];
}

/* Altera um atributo. Ao diminuir, os pontos daquele nível saem do pool da
   categoria e o treino excedente é removido; os demais atributos não mudam. */
function applyAttrChange(attr, next) {
  const prev = attrs[attr];
  const c = catById(attr);                       // Espírito não tem pool
  const totalBefore = c ? totalPoints(c) : 0;
  const spentBefore = c ? spentPoints(c) : 0;
  attrs[attr] = next;
  if (!c) return;
  if (next < prev) {
    const items = enforceBudget(c);
    const lost = totalBefore - totalPoints(c);
    const removed = spentBefore - spentPoints(c);
    if (lost > 0 || items.length) {
      const last = affected[c.id];
      if (last && !last.reason && last.to === prev) {
        // reduções seguidas viram um único aviso (ex.: Corpo 3 → 1)
        last.to = next;
        last.lost += lost;
        last.removed += removed;
        items.forEach(i => {
          const e = last.items.find(x => x.id === i.id);
          if (e) e.to = i.to; else last.items.push(i);
        });
      } else {
        affected[c.id] = { from: prev, to: next, lost, removed, items };
      }
    }
  }
  // Ao aumentar, o aviso anterior continua visível até ser dispensado:
  // o treino removido não volta sozinho.
}

function noticeHTML(c) {
  const a = affected[c.id];
  if (!a) return "";
  let h;
  if (a.reason === "load") {
    h = `<strong>${c.name}: treino ajustado ao abrir o personagem.</strong> ` +
      `O treino salvo custava mais do que os Pontos de Perícia de ${c.name} ${attrs[c.id]}, ` +
      `então as compras mais recentes foram removidas. `;
  } else {
    const levels = a.from - a.to === 1 ? `pelo nível ${a.from}` : `pelos níveis ${a.to + 1} a ${a.from}`;
    h = `<strong>${c.name} ${a.from} → ${a.to}.</strong> ` +
      (a.lost > 0 ? `${a.lost} Pontos de Perícia concedidos ${levels} foram removidos. ` : "");
  }
  if (a.items.length) {
    h += `Itens afetados (compras mais recentes removidas primeiro):<ul>` +
      a.items.map(i => i.ability
        ? `<li><b>${esc(i.name)}</b>: removida (Perícia de Atributo/Maestria)</li>`
        : `<li><b>${esc(i.name)}</b>: nível ${i.from} → ${i.to}</li>`).join("") + `</ul>`;
  } else if (a.lost > 0) {
    h += "Nenhuma perícia foi afetada: eram pontos que ainda não tinham sido gastos.";
  }
  return h;
}

const commit = () => { touch(); renderSkills(); };

/* ---------- Ações ---------- */

function train(id, dir) {
  const c = catOf(id);
  const s = pState.skills[id];
  if (dir > 0) {
    if (!canUpgrade(c, id)) return;
    s.lv++;
    hist[c.id].push(id);
  } else {
    if (s.lv <= 0) return;
    s.lv--;
    removeLast(hist[c.id], id);       // o nível gratuito não tem entrada no histórico
    if (s.lv === 0) s.free = false;   // perícia gratuita sem treino libera a vaga
  }
  affected[c.id] = null;
  commit();
}

function toggleFree(id) {
  const c = catOf(id);
  const s = pState.skills[id];
  if (s.free) {
    if (s.lv > 1) {
      // deixar de ser gratuita faz o nível 1 passar a custar 1 ponto
      if (totalPoints(c) - spentPoints(c) < 1) return;
      hist[c.id].push(id);
    }
    s.free = false;
    if (s.lv === 1) s.lv = 0;          // só tinha o nível gratuito
  } else {
    if (freeUsed(c) >= c.free) return;
    s.free = true;
    if (s.lv === 0) s.lv = 1;
    else removeFirst(hist[c.id], id);  // o primeiro nível pago passa a ser gratuito
  }
  affected[c.id] = null;
  commit();
}

function changeAdv(id, dir) {
  const s = pState.skills[id];
  s.adv = Math.max(0, s.adv + dir);
  commit();
}

/* ==========================================================
   PERÍCIAS DE ATRIBUTO E PERÍCIAS DE MAESTRIA
   (dados em habilidades.js). Cada compra desconta do pool de
   Pontos de Perícia do atributo correspondente — o mesmo pool
   usado pelo treino das Perícias, então nunca fica negativo.
   ========================================================== */

const HAB_TOKEN = "hab:";          // entradas no histórico de compras (LIFO)
const HAB_EXTRA_TOKEN = "hab:mma+"; // vantagem + desvantagem extras do MMA

const HAB = {};
const HAB_GROUP = {};
HAB_GROUPS.forEach(g => { HAB_GROUP[g.id] = g; });
HABS.forEach(h => {
  const g = HAB_GROUP[h.group];
  h.attr = g.attr;
  h.tipo = g.tipo;
  h.cost = HAB_COST[g.tipo];
  HAB[h.id] = h;
});

/* Opções do MMA: chave "<luta>#a<n>" (vantagem) ou "<luta>#d<n>" (desvantagem). */
const MMA_OPT = {};
HABS.filter(h => h.group === "atributo-corpo").forEach(h => {
  [["adv", "a"], ["dis", "d"]].forEach(([kind, ch]) => {
    (h.mma[kind] || []).forEach((o, i) => {
      const key = `${h.id}#${ch}${i}`;
      MMA_OPT[key] = {
        key, luta: h.id, kind,
        text: has(o, "b") ? h.bullets[o.b] : o.t,
        die: o.die || 0, lvl: o.lvl || 0,
      };
    });
  });
});

const pAbil = { owned: [], mma: { adv: [], dis: [], extra: false } };
const habOpen = new Set();   // caixas expandidas (só visual, não é salvo)
let habsBuilt = false;

const emptyAbil = () => ({ owned: [], mma: { adv: [], dis: [], extra: false } });
const ctxNow = () => ({ attrs, skills: pState.skills, abil: pAbil });

const habCost = (id, ab) => HAB[id].cost + (id === "mma" && ab.mma.extra ? MMA_EXTRA_COST : 0);
const abilSpent = (c, ab) => ab.owned.reduce((t, id) => (HAB[id].attr === c.id ? t + habCost(id, ab) : t), 0);
const poolLeft = (c, ctx) => catTotal(c, ctx.attrs) - catSpent(c, ctx.skills, ctx.abil);
const mmaSlots = ab => MMA_BASE_SLOTS + (ab.mma.extra ? MMA_EXTRA_SLOTS : 0);

/* ---------- Requisitos (validados aqui, não só exibidos) ---------- */

function reqEval(r, ctx) {
  switch (r.k) {
    case "trained": {
      const lv = ctx.skills[r.skill].lv;
      return { ok: lv >= 1, label: `Treinamento em ${SKILLS[r.skill].name}` };
    }
    case "level": {
      const lv = ctx.skills[r.skill].lv;
      return { ok: lv >= r.lv, label: `${r.lv} níveis de treinamento em ${SKILLS[r.skill].name} (atual: ${lv})` };
    }
    case "attr": {
      const v = ctx.attrs[r.attr];
      return { ok: v >= r.min, label: `${r.label || `${ATTR_NAMES[r.attr]} ${r.min} ou mais`} (atual: ${v})` };
    }
    case "any":
      return { ok: r.opts.some(o => reqEval(o, ctx).ok), label: r.label };
    case "knownLutas": {
      const n = lutasConhecidas(ctx).length;
      return { ok: n >= r.n, label: `Conhecer ${r.n} Perícias de Luta diferentes (atual: ${n})` };
    }
    case "notOwned":
      return { ok: !ctx.abil.owned.includes(r.id), label: r.label };
    case "noMaestriaLuta": {
      const other = ctx.abil.owned.find(id => HAB[id].group === "maestria-corpo" && id !== "mma");
      return { ok: !other, label: "Não pode ser usada com outras Lutas de Maestria" };
    }
  }
  return { ok: false, label: "Requisito desconhecido" };
}

const habReqs = (id, ctx) => HAB[id].req.map(r => reqEval(r, ctx));
const habReqsOk = (id, ctx) => habReqs(id, ctx).every(r => r.ok);
// Perícias de Luta "conhecidas": compradas e com requisitos cumpridos
const lutasConhecidas = ctx =>
  ctx.abil.owned.filter(id => HAB[id].group === "atributo-corpo" && habReqsOk(id, ctx));

/* ---------- MMA ---------- */

function mmaTotals(ab) {
  const t = { die: 0, lvl: 0 };
  ab.mma.adv.forEach(k => { if (MMA_OPT[k]) { t.die += MMA_OPT[k].die; t.lvl += MMA_OPT[k].lvl; } });
  return t;
}

// Por que a opção não pode ser escolhida (null = pode)
function mmaPickBlock(key, ctx) {
  const o = MMA_OPT[key];
  const ab = ctx.abil;
  if (!o) return "Opção inválida.";
  if (!ab.owned.includes("mma")) return "Compre o MMA primeiro.";
  if (!lutasConhecidas(ctx).includes(o.luta)) return "Você não conhece esta luta (ou ela está inválida).";
  const list = o.kind === "adv" ? ab.mma.adv : ab.mma.dis;
  const other = o.kind === "adv" ? ab.mma.dis : ab.mma.adv;
  if (list.length >= mmaSlots(ab)) return `Limite de ${mmaSlots(ab)} ${o.kind === "adv" ? "vantagens" : "desvantagens"} atingido.`;
  if (list.length > other.length) {
    return `Escolha antes ${o.kind === "adv" ? "a desvantagem" : "a vantagem"} correspondente: sempre o mesmo número de cada.`;
  }
  if (o.kind === "adv") {
    const t = mmaTotals(ab);
    if (t.die + o.die > MMA_CAP_DIE) return `Só acumulam até ${MMA_CAP_DIE} aumentos de dado de dano.`;
    if (t.lvl + o.lvl > MMA_CAP_LEVEL) return `Só acumulam até ${MMA_CAP_LEVEL} aumentos de nível de dano.`;
  }
  return null;
}

// Seleções vindas de lutas que o jogador deixou de conhecer
const mmaStale = ctx => {
  const known = lutasConhecidas(ctx);
  return [...ctx.abil.mma.adv, ...ctx.abil.mma.dis].filter(k => !MMA_OPT[k] || !known.includes(MMA_OPT[k].luta));
};
const mmaBalanced = ab => ab.mma.adv.length === ab.mma.dis.length;

/* Estado completo de uma Perícia: comprada? válida? pode comprar? */
function habStatus(id, ctx) {
  const h = HAB[id];
  const c = catById(h.attr);
  const owned = ctx.abil.owned.includes(id);
  const reqs = habReqs(id, ctx);
  const reqOk = reqs.every(r => r.ok);
  const left = poolLeft(c, ctx);
  const cost = habCost(id, ctx.abil);
  let block = null;
  if (owned) block = "Já comprada.";
  else if (!reqOk) block = "Requisitos não cumpridos.";
  else if (left < 0) block = "Alocação de pontos inválida: corrija antes de comprar.";
  else if (left < cost) block = `Pontos de Perícia de ${c.name} insuficientes (restam ${left}, custa ${cost}).`;
  return { h, c, owned, reqs, reqOk, valid: owned && reqOk, left, cost, canBuy: block === null, block };
}

/* ---------- Ações ---------- */

function buyHab(id) {
  const st = habStatus(id, ctxNow());
  if (!st.canBuy) return;                       // validação real, não só o botão
  pAbil.owned.push(id);
  hist[st.h.attr].push(HAB_TOKEN + id);
  if (id === "mma") pAbil.mma = { adv: [], dis: [], extra: false };
  affected[st.h.attr] = null;
  habOpen.add(id);
  commit();
}

function dropMmaExtra() {
  pAbil.mma.extra = false;
  pAbil.mma.adv = pAbil.mma.adv.slice(0, MMA_BASE_SLOTS);
  pAbil.mma.dis = pAbil.mma.dis.slice(0, MMA_BASE_SLOTS);
}

function removeHab(id) {
  if (!pAbil.owned.includes(id)) return;
  const h = HAB[id];
  pAbil.owned = pAbil.owned.filter(x => x !== id);
  removeLast(hist[h.attr], HAB_TOKEN + id);
  if (id === "mma") {
    removeLast(hist[h.attr], HAB_EXTRA_TOKEN);
    pAbil.mma = { adv: [], dis: [], extra: false };
  }
  affected[h.attr] = null;
  commit();
}

function toggleMmaExtra() {
  if (!pAbil.owned.includes("mma")) return;
  const c = catById("corpo");
  if (pAbil.mma.extra) {
    // só devolve se as escolhas ainda cabem nas vagas básicas
    if (pAbil.mma.adv.length > MMA_BASE_SLOTS || pAbil.mma.dis.length > MMA_BASE_SLOTS) return;
    pAbil.mma.extra = false;
    removeLast(hist.corpo, HAB_EXTRA_TOKEN);
  } else {
    const left = poolLeft(c, ctxNow());
    if (left < MMA_EXTRA_COST) return;
    pAbil.mma.extra = true;
    hist.corpo.push(HAB_EXTRA_TOKEN);
  }
  affected.corpo = null;
  commit();
}

function toggleMmaPick(key) {
  const o = MMA_OPT[key];
  if (!o || !pAbil.owned.includes("mma")) return;
  const list = o.kind === "adv" ? pAbil.mma.adv : pAbil.mma.dis;
  const i = list.indexOf(key);
  if (i >= 0) list.splice(i, 1);
  else {
    if (mmaPickBlock(key, ctxNow())) return;
    list.push(key);
  }
  commit();
}

function resetHabs() {
  CATEGORIES.forEach(c => { hist[c.id] = hist[c.id].filter(t => !t.startsWith(HAB_TOKEN)); affected[c.id] = null; });
  Object.assign(pAbil, emptyAbil());
  habOpen.clear();
  commit();
}

/* Chamado por enforceBudget: remove uma compra de habilidade do histórico. */
function undoHabToken(token, hit) {
  if (token === HAB_EXTRA_TOKEN) {
    if (pAbil.mma.extra) dropMmaExtra();
    hit.set(token, { id: token, name: "MMA: vantagem e desvantagem extras", ability: true });
    return;
  }
  const id = token.slice(HAB_TOKEN.length);
  if (!pAbil.owned.includes(id)) return;       // entrada órfã
  pAbil.owned = pAbil.owned.filter(x => x !== id);
  if (id === "mma") pAbil.mma = { adv: [], dis: [], extra: false };
  hit.set(token, { id: token, name: HAB[id].name, ability: true });
}

/* ---------- Interface ---------- */

const habDescHTML = h =>
  h.desc.map(p => `<p class="hab-text">${esc(p)}</p>`).join("") +
  (h.bullets.length ? `<ul class="hab-list">${h.bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : "");

function habCardHTML(h) {
  const reqNote = h.req.length ? "" : `<span class="hab-noreq">Sem requisitos</span>`;
  return `
    <article class="hab" data-hab="${h.id}">
      <h5 class="hab-head">
        <button type="button" class="hab-toggle" data-act="hab-toggle" aria-expanded="false" aria-controls="hab-body-${h.id}">
          <span class="hab-name">${esc(h.name)}</span>
          <span class="hab-cost">${h.cost} pts</span>
          <span class="hab-state" data-state></span>
          <span class="hab-chev" aria-hidden="true">▾</span>
        </button>
      </h5>
      <p class="hab-sub" data-sub hidden></p>
      <p class="hab-lock" data-lock hidden></p>
      <div class="hab-body" id="hab-body-${h.id}" hidden>
        ${habDescHTML(h)}
        <div class="hab-reqs"><span class="hab-reqs-title">Requisitos</span>${reqNote}<ul data-reqs></ul></div>
        ${h.special === "mma" ? '<div class="mma" data-mma></div>' : ""}
      </div>
      <div class="hab-actions">
        <button type="button" class="primary-btn hab-buy" data-act="hab-buy">Comprar (${h.cost} pts)</button>
        <button type="button" class="reset" data-act="hab-remove" hidden>Remover</button>
      </div>
    </article>`;
}

function buildHabs() {
  const host = el("habRoot");
  HAB_GROUPS.forEach(g => {
    const c = catById(g.attr);
    const cost = HAB_COST[g.tipo];
    const mastery = g.tipo === "maestria";
    const sec = document.createElement("section");
    sec.className = `card panel themed t-${g.attr} hab-group hab-${g.tipo}`;
    sec.dataset.group = g.id;
    sec.setAttribute("aria-label", g.title);
    sec.innerHTML = `
      <header class="panel-head">
        <div class="hab-titles">
          <span class="hab-badge">${mastery ? "◆ Maestria" : "Atributo"}</span>
          <h3 class="panel-title">${g.title}</h3>
        </div>
        <div class="points hab-pool" data-pool>
          <span class="points-label">Pontos de Perícia de ${c.name}</span>
          <span class="points-value"><b data-left>0</b> / <span data-total>0</span></span>
        </div>
      </header>
      <p class="hint">Cada ${mastery ? "Perícia de Maestria" : "Perícia de Atributo"} custa ${cost} Pontos de Perícia de ${c.name}, do mesmo pool das Perícias de ${c.name} acima.</p>
      <h4 class="sub">${g.category}</h4>
      <div class="hab-grid">${HABS.filter(h => h.group === g.id).map(habCardHTML).join("")}</div>`;
    host.appendChild(sec);
  });
  habsBuilt = true;
}

function mmaPanelHTML(st, ctx) {
  const ab = ctx.abil;
  const slots = mmaSlots(ab);
  const t = mmaTotals(ab);
  const known = lutasConhecidas(ctx);
  const stale = mmaStale(ctx);
  const sel = new Set([...ab.mma.adv, ...ab.mma.dis]);
  const c = catById("corpo");
  const left = poolLeft(c, ctx);

  const opt = o => {
    const on = sel.has(o.key);
    const why = on ? null : mmaPickBlock(o.key, ctx);
    const tags = [o.die ? "+1 dado" : "", o.lvl ? "+1 nível" : ""].filter(Boolean).join(", ");
    return `<button type="button" class="mma-opt ${o.kind}" data-act="mma-pick" data-key="${o.key}"
        aria-pressed="${on}" ${why ? "disabled" : ""}>
        <span class="mma-opt-text">${esc(o.text)}${tags ? ` <em>(${tags})</em>` : ""}</span>
        ${why ? `<small class="why">${esc(why)}</small>` : ""}
      </button>`;
  };

  const styles = known.map(id => {
    const advs = Object.values(MMA_OPT).filter(o => o.luta === id && o.kind === "adv");
    const dis = Object.values(MMA_OPT).filter(o => o.luta === id && o.kind === "dis");
    return `
      <div class="mma-style">
        <h6>${esc(HAB[id].name)}</h6>
        <div class="mma-col"><span class="mma-kind">Vantagens</span>${advs.map(opt).join("")}</div>
        <div class="mma-col"><span class="mma-kind">Desvantagens</span>${dis.length ? dis.map(opt).join("") : '<span class="mma-none">Esta luta não tem desvantagens.</span>'}</div>
      </div>`;
  }).join("");

  const staleHTML = stale.length ? `
    <div class="mma-stale">
      <strong>Escolhas de lutas que você não conhece mais</strong> (suspensas; desmarque ou volte a conhecer a luta):
      ${stale.map(k => `<button type="button" class="mma-opt ${MMA_OPT[k] ? MMA_OPT[k].kind : "adv"}" data-act="mma-pick" data-key="${esc(k)}" aria-pressed="true">
        <span class="mma-opt-text">${esc(MMA_OPT[k] ? `${HAB[MMA_OPT[k].luta].name}: ${MMA_OPT[k].text}` : k)}</span></button>`).join("")}
    </div>` : "";

  const canDropExtra = ab.mma.adv.length <= MMA_BASE_SLOTS && ab.mma.dis.length <= MMA_BASE_SLOTS;
  const extraBtn = ab.mma.extra
    ? `<button type="button" class="reset" data-act="mma-extra" ${canDropExtra ? "" : "disabled"}>Remover extras (devolve ${MMA_EXTRA_COST} pts)</button>
       ${canDropExtra ? "" : `<small class="why">Desmarque a vantagem e a desvantagem extras antes de remover.</small>`}`
    : `<button type="button" class="primary-btn" data-act="mma-extra" ${left >= MMA_EXTRA_COST ? "" : "disabled"}>+1 vantagem e +1 desvantagem (${MMA_EXTRA_COST} pts)</button>
       ${left >= MMA_EXTRA_COST ? "" : `<small class="why">Pontos de Perícia de Corpo insuficientes (restam ${left}).</small>`}`;

  let status;
  if (!st.reqOk) status = "MMA temporariamente inválido: efeitos suspensos até cumprir os requisitos.";
  else if (stale.length) status = "Há escolhas de lutas desconhecidas: efeitos suspensos até corrigir.";
  else if (!mmaBalanced(ab)) status = "Incompleto: escolha sempre o mesmo número de vantagens e desvantagens.";
  else if (ab.mma.adv.length < slots) status = `Escolha mais ${slots - ab.mma.adv.length} vantagem(ns) e ${slots - ab.mma.dis.length} desvantagem(ns).`;
  else status = "Seleção completa.";

  return `
    <h6 class="mma-title">Vantagens e desvantagens do MMA</h6>
    <p class="mma-count">
      <span>Vantagens <b>${ab.mma.adv.length}/${slots}</b></span>
      <span>Desvantagens <b>${ab.mma.dis.length}/${slots}</b></span>
      <span>Dado de dano <b>+${t.die}/${MMA_CAP_DIE}</b></span>
      <span>Nível de dano <b>+${t.lvl}/${MMA_CAP_LEVEL}</b></span>
    </p>
    <p class="mma-status ${status === "Seleção completa." ? "ok" : "warn"}">${status}</p>
    <div class="mma-extra">${extraBtn}</div>
    ${known.length ? styles : '<p class="mma-none">Você não conhece nenhuma Perícia de Luta válida.</p>'}
    ${staleHTML}`;
}

function updateHabs() {
  if (!habsBuilt) return;
  const ctx = ctxNow();

  document.querySelectorAll(".hab-group").forEach(sec => {
    const g = HAB_GROUP[sec.dataset.group];
    const c = catById(g.attr);
    const total = catTotal(c, attrs);
    const left = total - catSpent(c, pState.skills, pAbil);
    setText(sec.querySelector("[data-left]"), String(left));
    setText(sec.querySelector("[data-total]"), String(total));
    sec.querySelector("[data-pool]").classList.toggle("invalid", left < 0);
  });

  document.querySelectorAll(".hab[data-hab]").forEach(card => {
    const id = card.dataset.hab;
    const st = habStatus(id, ctx);
    const open = habOpen.has(id);
    const q = s => card.querySelector(s);

    card.classList.toggle("owned", st.owned);
    card.classList.toggle("invalid", st.owned && !st.reqOk);
    card.classList.toggle("locked", !st.owned && !st.reqOk);
    card.classList.toggle("open", open);
    q('[data-act="hab-toggle"]').setAttribute("aria-expanded", String(open));
    q(".hab-body").hidden = !open;

    q("[data-state]").textContent = st.owned
      ? (st.reqOk ? "✓ Comprada" : "⚠ Inválida")
      : (st.reqOk ? "Disponível" : "🔒 Bloqueada");

    // Requisitos não cumpridos (sempre visíveis) e motivo de bloqueio
    const unmet = st.reqs.filter(r => !r.ok).map(r => r.label);
    const lock = q("[data-lock]");
    let msg = "";
    if (st.owned && unmet.length) msg = `Temporariamente inválida, efeitos suspensos até cumprir: ${unmet.join("; ")}.`;
    else if (!st.owned && unmet.length) msg = `Requisitos não cumpridos: ${unmet.join("; ")}.`;
    else if (!st.owned && st.block) msg = st.block;
    lock.textContent = msg;
    lock.hidden = !msg;

    q("[data-reqs]").innerHTML = st.reqs.map(r =>
      `<li class="${r.ok ? "ok" : "no"}"><span aria-hidden="true">${r.ok ? "✓" : "✗"}</span> ${esc(r.label)}</li>`).join("");

    const buy = q('[data-act="hab-buy"]');
    buy.hidden = st.owned;
    buy.disabled = !st.canBuy;
    buy.textContent = `Comprar (${st.cost} pts)`;
    buy.title = st.canBuy ? "" : (st.block || "");
    const rm = q('[data-act="hab-remove"]');
    rm.hidden = !st.owned;
    rm.textContent = `Remover (devolve ${st.cost} pts)`;

    const sub = q("[data-sub]");
    if (id === "mma" && st.owned) {
      const sl = mmaSlots(pAbil);
      sub.textContent = `Vantagens ${pAbil.mma.adv.length}/${sl} · Desvantagens ${pAbil.mma.dis.length}/${sl}` +
        (pAbil.mma.extra ? " · extras compradas" : "");
      sub.hidden = false;
    } else sub.hidden = true;

    const mma = q("[data-mma]");
    if (mma) {
      mma.hidden = !st.owned;
      if (st.owned && open) {
        const a = document.activeElement;
        const keep = a && mma.contains(a) ? (a.dataset.key || a.dataset.act) : null;
        mma.innerHTML = mmaPanelHTML(st, ctx);
        if (keep) {
          const again = mma.querySelector(`[data-key="${keep}"], [data-act="${keep}"]`);
          if (again && !again.disabled) again.focus({ preventScroll: true });
        }
      }
    }
  });
}

/* ---------- Rolagens ---------- */

const rollBoxHTML = () => `
  <div class="roll-box" data-box>
    <div class="roll-title" data-title>Nenhuma rolagem ainda</div>
    <div class="roll-dice" data-dice></div>
    <div class="roll-sum" data-sum></div>
    <span class="sr-only" data-live aria-live="polite"></span>
  </div>`;

function playRoll(box, cfg) {
  const title = box.querySelector("[data-title]");
  const diceEl = box.querySelector("[data-dice]");
  const sumEl = box.querySelector("[data-sum]");
  const live = box.querySelector("[data-live]");

  clearInterval(box._timer);
  box.classList.add("has-roll");
  title.textContent = cfg.title;
  sumEl.innerHTML = "";
  live.textContent = "";
  diceEl.innerHTML = cfg.dice.map(() =>
    `<div class="die-wrap"><div class="die d${cfg.sides} rolling"><span>?</span></div><small class="die-tag">&nbsp;</small></div>`
  ).join("");

  const wraps = [...diceEl.children];
  const faces = wraps.map(w => w.querySelector(".die span"));
  const started = performance.now();
  const duration = reduceMotion ? 120 : 750;

  const settle = () => {
    wraps.forEach((w, i) => {
      faces[i].textContent = cfg.dice[i];
      const die = w.querySelector(".die");
      die.classList.remove("rolling");
      die.classList.add("landed");
      if (cfg.kept !== null) {
        const keep = i === cfg.kept;
        w.classList.add(keep ? "kept" : "dropped");
        w.querySelector(".die-tag").textContent = keep ? "escolhido" : "descartado";
      }
    });
    const total = cfg.base + cfg.bonus;
    sumEl.innerHTML =
      `<div class="sum-part"><small>${cfg.baseLabel}</small><b>${cfg.base}</b></div>` +
      `<span class="op">+</span>` +
      `<div class="sum-part"><small>${cfg.bonusLabel}</small><b>${cfg.bonus}</b></div>` +
      `<span class="op">=</span>` +
      `<div class="sum-part total"><small>Final</small><b>${total}</b></div>`;
    live.textContent =
      `${cfg.title}: dados ${cfg.dice.join(" e ")}` +
      `${cfg.kept !== null ? `, escolhido ${cfg.dice[cfg.kept]}` : ""}` +
      `, ${cfg.bonusLabel} ${cfg.bonus}, resultado final ${total}.`;
  };

  box._timer = setInterval(() => {
    if (performance.now() - started < duration) {
      faces.forEach(f => { f.textContent = rollDie(cfg.sides); });
    } else {
      clearInterval(box._timer);
      settle();
    }
  }, 70);
}

function rollSkill(id, box) {
  const withAdv = advSources(id).length > 0;
  const dice = withAdv ? [rollDie(8), rollDie(8)] : [rollDie(8)];
  const kept = dice.length > 1 ? (dice[1] > dice[0] ? 1 : 0) : null;   // empate: primeiro dado
  const name = id === RES_ESPIRITO ? "Espírito (resistência)" : SKILLS[id].name;
  playRoll(box, {
    title: `${name}${withAdv ? " — com Vantagem" : ""}`,
    sides: 8,
    dice,
    kept,
    base: dice[kept === null ? 0 : kept],
    baseLabel: kept === null ? "Dado" : "Maior",
    bonus: bonusOf(id),
    bonusLabel: "Bônus",
  });
}

function rollDamage() {
  const n = attrs.corpo >= 3 ? 2 : 1;
  const dice = Array.from({ length: n }, () => rollDie(4));
  playRoll(el("damageCard").querySelector("[data-box]"), {
    title: `Dado de Dano — ${n}d4 + ${attrs.corpo}`,
    sides: 4,
    dice,
    kept: null,
    base: dice.reduce((a, b) => a + b, 0),
    baseLabel: "Dados",
    bonus: attrs.corpo,
    bonusLabel: "Corpo",
  });
}

/* ---------- Construção da interface ---------- */

function skillRow(id, name, opts) {
  const row = document.createElement("div");
  row.className = "skill";
  row.dataset.skill = id;
  row.innerHTML = `
    <div class="s-main">
      <span class="s-name">${name}</span>
      <span class="s-bonus" data-bonus>+0</span>
      <span class="s-badge" data-badge hidden>Vantagem</span>
      ${opts.train ? '<span class="s-affected" data-affected hidden></span>' : ""}
    </div>
    ${opts.train ? `
    <div class="s-train">
      <button type="button" class="free" data-act="free" aria-pressed="false"
        title="Perícia gratuita: começa treinada sem gastar pontos"><span aria-hidden="true">★</span> Grátis</button>
      <button type="button" class="step sm" data-act="train-down" aria-label="Diminuir treino de ${name}">−</button>
      <span class="pips" data-pips role="img" aria-label="Nível 0 de ${MAX_LEVEL}">${"<i></i>".repeat(MAX_LEVEL)}</span>
      <button type="button" class="step sm" data-act="train-up" aria-label="Aumentar treino de ${name}">+</button>
      <span class="lvl" data-lvl>Sem treino</span>
    </div>` : `<div class="s-train s-note">${opts.note}</div>`}
    <div class="s-adv">
      <span class="s-lbl">Vantagem</span>
      <button type="button" class="step sm" data-act="adv-down" aria-label="Diminuir vantagem de ${name}">−</button>
      <b data-adv>0</b>
      <button type="button" class="step sm" data-act="adv-up" aria-label="Aumentar vantagem de ${name}">+</button>
    </div>
    <button type="button" class="roll-btn" data-act="roll" aria-label="Rolar teste de ${name}"><span data-rolllabel>Rolar 1d8</span></button>`;
  return row;
}

function buildPanels() {
  const host = el("skillPanels");
  CATEGORIES.forEach(c => {
    const sec = document.createElement("section");
    sec.className = `card panel themed t-${c.id}`;
    sec.dataset.cat = c.id;
    sec.setAttribute("aria-label", `Perícias de ${c.name}`);
    const gains = c.gains.map((g, i) => `${c.name} ${i + 1}: ${g ? "+" + g : "sem pontos"}`).join(" · ");
    sec.innerHTML = `
      <header class="panel-head">
        <h3 class="panel-title">${c.name}</h3>
        <div class="points" data-points>
          <span class="points-label">Pontos de Perícia</span>
          <span class="points-value"><b data-left>0</b> / <span data-total>0</span></span>
        </div>
      </header>
      <p class="hint">Pontos acumulados por valor — ${gains}.</p>
      <p class="free-line" data-freeline></p>
      <p class="warn" data-warn role="alert" hidden></p>
      <div class="notice" data-notice hidden>
        <div data-notice-body></div>
        <button type="button" class="notice-x" data-act="dismiss-notice" data-cat="${c.id}" aria-label="Dispensar aviso">×</button>
      </div>
      <div class="skill-list" data-list></div>
      ${rollBoxHTML()}`;
    const list = sec.querySelector("[data-list]");
    c.ids.forEach(id => list.appendChild(skillRow(id, SKILLS[id].name, { train: true })));
    host.appendChild(sec);
  });
}

function buildEspirito() {
  const sec = document.createElement("section");
  sec.className = "card panel themed t-espirito";
  sec.setAttribute("aria-label", "Opções de Espírito");

  const chips = CATEGORIES.map(c => `
    <div class="chip-group t-${c.id}">
      <span class="chip-cat">${c.name}</span>
      ${c.ids.map(id => `<button type="button" class="chip" data-act="esp-skill" data-id="${id}" aria-pressed="false">${SKILLS[id].name}</button>`).join("")}
    </div>`).join("");

  const abilities = ABILITIES.map(a => `
    <label class="ability">
      <input type="radio" name="ability" class="sr-only" data-act="esp-ability" value="${a.id}">
      <span class="ability-body">
        <span class="ability-head"><strong>${a.name}</strong><span class="flag">Selecionada</span></span>
        ${a.paras.map(p => `<span class="ability-text">${p}</span>`).join("")}
        ${(a.list || []).map(li => `<span class="ability-li">${li}</span>`).join("")}
      </span>
    </label>`).join("");

  sec.innerHTML = `
    <header class="panel-head">
      <h3 class="panel-title">Opções de Espírito</h3>
      <div class="points">
        <span class="points-label">Valor de Espírito</span>
        <span class="points-value"><b data-espval>0</b></span>
      </div>
    </header>

    <h4 class="sub">Opção A · Vantagem em Testes de Resistência</h4>
    <label class="choice">
      <input type="checkbox" class="sr-only" data-act="esp-resist">
      <span class="choice-body">
        <strong>Resistência reforçada</strong> <span class="flag">Ativa</span>
        <span class="choice-desc">O personagem ganha Vantagem em Fortitude e Espírito.</span>
      </span>
    </label>
    <div class="skill-list" data-reslist></div>

    <h4 class="sub">Opção B · Vantagem em uma Perícia</h4>
    <p class="hint">Escolha UMA perícia para receber Vantagem. Toque de novo para remover.</p>
    <div class="chip-groups">${chips}</div>

    <h4 class="sub">Opção C · Habilidade Especial</h4>
    <p class="hint">Escolha UMA habilidade.</p>
    <div class="ability-grid">${abilities}</div>
    <div class="ability-actions">
      <button type="button" class="reset" data-act="esp-ability-clear" data-espclear hidden>Limpar habilidade</button>
    </div>
    ${rollBoxHTML()}`;

  const list = sec.querySelector("[data-reslist]");
  list.appendChild(skillRow("fortitude", "Fortitude", { train: false, note: "Mesmo bônus da perícia Fortitude (Corpo)" }));
  list.appendChild(skillRow(RES_ESPIRITO, "Espírito", { train: false, note: "Bônus = valor de Espírito" }));
  el("espiritoRoot").appendChild(sec);
}

function buildFx() {
  document.querySelectorAll(".themed").forEach(host => {
    const theme = THEMES.find(t => host.classList.contains("t-" + t));
    const fx = document.createElement("div");
    fx.className = "fx fx-" + theme;
    fx.setAttribute("aria-hidden", "true");
    const small = host.classList.contains("attr") || host.classList.contains("damage");
    const count = theme === "mente" ? (small ? 4 : 9) : theme === "persona" ? (small ? 3 : 6) : 0;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      const d = theme === "persona" ? rand(6, 11) : rand(10, 20);
      const size = theme === "persona" ? rand(12, 22).toFixed(0) : rand(2, 5).toFixed(1);
      p.style.cssText =
        `--x:${rand(2, 94).toFixed(1)}%;--y:${rand(10, 90).toFixed(1)}%;` +
        `--d:${d.toFixed(1)}s;--dl:-${rand(0, d).toFixed(1)}s;` +
        `--dx:${rand(-20, 20).toFixed(0)}px;--s:${size}px;--r:${rand(-15, 15).toFixed(0)}deg`;
      if (theme === "persona") p.textContent = "!";
      fx.appendChild(p);
    }
    host.prepend(fx);
  });
}

/* ---------- Renderização ---------- */

function updateRow(row) {
  const id = row.dataset.skill;
  const s = pState.skills[id];
  const q = sel => row.querySelector(sel);

  setText(q("[data-bonus]"), "+" + bonusOf(id));

  const up = q('[data-act="train-up"]');
  if (up) {
    const c = catOf(id);
    q('[data-act="train-down"]').disabled = s.lv <= 0;
    up.disabled = !canUpgrade(c, id);
    const fr = q('[data-act="free"]');
    fr.setAttribute("aria-pressed", String(s.free));
    const left = totalPoints(c) - spentPoints(c);
    fr.disabled = (!s.free && freeUsed(c) >= c.free) || (s.free && s.lv > 1 && left < 1);
    q("[data-pips]").querySelectorAll("i").forEach((p, i) => p.classList.toggle("on", i < s.lv));
    q("[data-pips]").setAttribute("aria-label", `Nível ${s.lv} de ${MAX_LEVEL}`);
    setText(q("[data-lvl]"), s.lv === 0 ? "Sem treino" : s.lv === 1 ? "Treinada" : `Nível ${s.lv}`);
    row.classList.toggle("trained", s.lv > 0);

    // Perícia afetada pela última redução de atributo
    const a = affected[c.id];
    const hit = a ? a.items.find(i => i.id === id) : null;
    row.classList.toggle("affected", !!hit);
    const tag = q("[data-affected]");
    tag.hidden = !hit;
    tag.textContent = hit ? `−${hit.from - hit.to} nível(is)` : "";
  }

  setText(q("[data-adv]"), String(s.adv));
  q('[data-act="adv-down"]').disabled = s.adv <= 0;

  const src = advSources(id);
  const badge = q("[data-badge]");
  badge.hidden = src.length === 0;
  badge.title = src.length ? "Vantagem por: " + src.join(", ") : "";
  q("[data-rolllabel]").textContent = src.length ? "Rolar 2d8" : "Rolar 1d8";
}

function renderSkills() {
  if (!skillsBuilt) return;

  CATEGORIES.forEach(c => {
    const panel = document.querySelector(`.panel[data-cat="${c.id}"]`);
    const total = totalPoints(c);
    const spent = spentPoints(c);
    const left = total - spent;
    const bad = left < 0;

    setText(panel.querySelector("[data-left]"), String(left));
    setText(panel.querySelector("[data-total]"), String(total));
    panel.querySelector("[data-points]").classList.toggle("invalid", bad);

    const warn = panel.querySelector("[data-warn]");
    warn.hidden = !bad;
    if (bad) {
      warn.textContent =
        `Alocação inválida: ${spent} pontos gastos, mas ${c.name} ${attrs[c.id]} dá apenas ${total}. ` +
        `Remova ${-left} ponto(s) de treino ou aumente ${c.name}. Novas melhorias ficam bloqueadas até corrigir.`;
    }

    const used = freeUsed(c);
    panel.querySelector("[data-freeline]").innerHTML =
      `Perícias gratuitas: <strong>${used}/${c.free}</strong> — ` +
      (used < c.free
        ? `escolha mais ${c.free - used} com ★ Grátis (começam no nível 1, sem custo).`
        : "todas escolhidas.");

    const nh = noticeHTML(c);
    panel.querySelector("[data-notice]").hidden = !nh;
    panel.querySelector("[data-notice-body]").innerHTML = nh;
  });

  // Resumo dos avisos junto aos atributos, onde o jogador fez a alteração
  const shown = CATEGORIES.filter(c => affected[c.id]);
  const top = el("attrNotice");
  top.hidden = shown.length === 0;
  top.innerHTML = shown.map(c => `
    <div class="notice">
      <div>${noticeHTML(c)}</div>
      <button type="button" class="notice-x" data-act="dismiss-notice" data-cat="${c.id}" aria-label="Dispensar aviso de ${c.name}">×</button>
    </div>`).join("");

  document.querySelectorAll(".skill[data-skill]").forEach(updateRow);

  // Espírito
  document.querySelector('[data-act="esp-resist"]').checked = pState.esp.resist;
  document.querySelectorAll('[data-act="esp-skill"]').forEach(b =>
    b.setAttribute("aria-pressed", String(pState.esp.advSkill === b.dataset.id)));
  document.querySelectorAll('[data-act="esp-ability"]').forEach(i => {
    i.checked = pState.esp.ability === i.value;
  });
  document.querySelector("[data-espclear]").hidden = !pState.esp.ability;
  setText(document.querySelector("[data-espval]"), String(attrs.espirito));

  // Dado de Dano
  setText(el("out-dano"), `${attrs.corpo >= 3 ? 2 : 1}d4 + ${attrs.corpo}`);

  // Perícias de Atributo e de Maestria
  updateHabs();
}

/* ---------- Eventos ---------- */

document.addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const row = b.closest(".skill[data-skill]");
  const id = row ? row.dataset.skill : b.dataset.id;

  switch (b.dataset.act) {
    case "train-up":   train(id, 1); break;
    case "train-down": train(id, -1); break;
    case "free":       toggleFree(id); break;
    case "adv-up":     changeAdv(id, 1); break;
    case "adv-down":   changeAdv(id, -1); break;
    case "roll":       rollSkill(id, row.closest(".panel").querySelector("[data-box]")); break;
    case "esp-skill":
      pState.esp.advSkill = pState.esp.advSkill === id ? null : id;
      commit();
      break;
    case "esp-ability-clear":
      pState.esp.ability = null;
      commit();
      break;
    case "dismiss-notice":
      affected[b.dataset.cat] = null;
      renderSkills();
      break;
    case "hab-toggle": {
      const hid = b.closest("[data-hab]").dataset.hab;
      if (habOpen.has(hid)) habOpen.delete(hid); else habOpen.add(hid);
      updateHabs();
      break;
    }
    case "hab-buy":    buyHab(b.closest("[data-hab]").dataset.hab); break;
    case "hab-remove": removeHab(b.closest("[data-hab]").dataset.hab); break;
    case "mma-pick":   toggleMmaPick(b.dataset.key); break;
    case "mma-extra":  toggleMmaExtra(); break;
    case "open-char":   openCharacter(id); break;
    case "rename-char": renameCharacter(id); break;
    case "export-char": exportStored(id); break;
    case "delete-char": deleteCharacter(id); break;
  }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  if (t.dataset.act === "esp-resist") {
    pState.esp.resist = t.checked;
    commit();
  } else if (t.dataset.act === "esp-ability") {
    pState.esp.ability = t.checked ? t.value : null;
    commit();
  }
});

el("rollDamage").addEventListener("click", rollDamage);

function resetSkills() {
  Object.keys(SKILLS).forEach(id => { pState.skills[id] = { lv: 0, adv: 0, free: false }; });
  CATEGORIES.forEach(c => { hist[c.id] = []; affected[c.id] = null; });
  Object.assign(pAbil, emptyAbil());   // os pontos gastos nas Perícias de Atributo/Maestria também voltam
  habOpen.clear();
  commit();
}

el("resetSkills").addEventListener("click", () => {
  const ids = Object.keys(SKILLS);
  const spent = CATEGORIES.reduce((t, c) => t + spentPoints(c), 0);
  const trained = ids.filter(id => pState.skills[id].lv > 0).length;
  openModal({
    title: "Redefinir perícias?",
    body: `
      <p><strong>Atenção:</strong> suas Perícias serão redefinidas.</p>
      <p>Agora você tem ${trained} perícia(s) treinada(s) e ${spent} Ponto(s) de Perícia investido(s).</p>
      <ul>
        <li>Todo o treino volta ao nível 0 e os pontos gastos são devolvidos.</li>
        <li>As perícias gratuitas escolhidas e os contadores de Vantagem das perícias voltam a 0.</li>
        <li>As Perícias de Atributo e de Maestria compradas também são removidas e seus pontos devolvidos.</li>
        <li>Atributos e opções de Espírito não são alterados.</li>
      </ul>
      <p>Esta ação não pode ser desfeita.</p>`,
    okLabel: "Confirmar",
    seconds: 5,
    danger: true,
    onConfirm: resetSkills,
  });
});

el("resetHabs").addEventListener("click", () => {
  const spent = CATEGORIES.reduce((t, c) => t + abilSpent(c, pAbil), 0);
  openModal({
    title: "Redefinir Perícias de Atributo e de Maestria?",
    body: `
      <p><strong>Atenção:</strong> todas as Perícias de Atributo e de Maestria compradas serão removidas.</p>
      <p>Agora você tem ${pAbil.owned.length} comprada(s), usando ${spent} Ponto(s) de Perícia.</p>
      <ul>
        <li>Os pontos gastos voltam ao pool do atributo correspondente.</li>
        <li>As escolhas do MMA também são apagadas.</li>
        <li>Atributos, treino das Perícias e opções de Espírito não mudam.</li>
      </ul>
      <p>Esta ação não pode ser desfeita.</p>`,
    okLabel: "Confirmar",
    seconds: 5,
    danger: true,
    onConfirm: resetHabs,
  });
});

/* ==========================================================
   CONFIRMAÇÃO (com contagem regressiva opcional)
   ========================================================== */

let modalCtl = null;

/* cfg: { title, body(html), okLabel, cancelLabel, seconds, danger, input, onConfirm(valor) }
   Nada é aplicado antes de o jogador confirmar. Com `seconds`, o botão de
   confirmação fica desativado e mostra "Confirmar (5)" … "Confirmar (0)". */
function openModal(cfg) {
  closeModal();
  const ok = el("modalOk");
  const okLabel = cfg.okLabel || "Confirmar";

  el("modalTitle").textContent = cfg.title;
  el("modalBody").innerHTML = cfg.body || "";
  el("modalInputWrap").hidden = !cfg.input;
  if (cfg.input) {
    const input = el("modalInput");
    el("modalInputLabel").textContent = cfg.input.label || "";
    input.value = cfg.input.value || "";
    input.maxLength = cfg.input.maxLength || NAME_MAX;
    input.placeholder = cfg.input.placeholder || "";
  }
  el("modalCancel").textContent = cfg.cancelLabel || "Cancelar";
  ok.className = cfg.danger ? "danger-btn" : "primary-btn";

  const ctl = { cfg, opener: document.activeElement, left: cfg.seconds || 0, timer: 0 };
  modalCtl = ctl;
  const paint = () => {
    ok.disabled = ctl.left > 0;
    ok.textContent = cfg.seconds ? `${okLabel} (${ctl.left})` : okLabel;
  };
  paint();
  if (cfg.seconds) {
    ctl.timer = setInterval(() => {
      ctl.left = Math.max(0, ctl.left - 1);
      paint();
      if (ctl.left === 0) clearInterval(ctl.timer);
    }, 1000);
  }

  el("modal").hidden = false;
  document.body.classList.add("modal-open");
  (cfg.input ? el("modalInput") : el("modalCancel")).focus();
}

function closeModal() {
  if (!modalCtl) return;
  clearInterval(modalCtl.timer);
  const opener = modalCtl.opener;
  modalCtl = null;
  el("modal").hidden = true;
  document.body.classList.remove("modal-open");
  if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
}

function confirmModal() {
  if (!modalCtl || el("modalOk").disabled) return;
  const cfg = modalCtl.cfg;
  const value = el("modalInput").value;
  closeModal();
  if (cfg.onConfirm) cfg.onConfirm(value);
}

el("modalOk").addEventListener("click", confirmModal);
el("modalCancel").addEventListener("click", closeModal);
el("modal").addEventListener("click", e => { if (e.target === el("modal")) closeModal(); });
el("modalInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); confirmModal(); } });
document.addEventListener("keydown", e => {
  if (!modalCtl) return;
  if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
  if (e.key !== "Tab") return;
  // mantém o foco dentro da janela
  const items = [...el("modal").querySelectorAll("button, input")].filter(n => !n.disabled && !n.closest("[hidden]"));
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ==========================================================
   PERSONAGENS: armazenamento, menu inicial, notas, JSON
   Cada personagem fica em sua própria chave do localStorage
   (rpg-ficha:v2:char:<id>), então nunca se misturam.
   ========================================================== */

const APP_ID = "rpg-ficha";
const KEY_PREFIX = "rpg-ficha:v2:char:";
const KEY_MIGRATED = "rpg-ficha:v2:migrated";
const LEGACY_ATTRS = "rpg-ficha-atributos";   // versões anteriores do site
const LEGACY_SKILLS = "rpg-ficha-pericias";
const NAME_MAX = 60;
const NOTE_MAX = 100000;
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const ATTR_NAMES = { corpo: "Corpo", mente: "Mente", persona: "Persona", espirito: "Espírito" };
const NOTE_FIELDS = { habilidades: "note-habilidades", habilidadesAtributo: "note-atributo", anotacoes: "note-pessoais" };
const NOTE_KEYS = Object.keys(NOTE_FIELDS);

let cur = null;       // personagem aberto: { id, created, name, notes }
let dirty = false;    // há alterações ainda não gravadas
let saveTimer = 0;

/* ---------- localStorage (com memória como reserva) ---------- */

const mem = new Map();
let storageOk = true;

function kvGet(k) {
  if (mem.has(k)) return mem.get(k);
  try { return localStorage.getItem(k); } catch (e) { storageOk = false; return null; }
}
function kvSet(k, v) {
  try { localStorage.setItem(k, v); mem.delete(k); storageOk = true; return true; }
  catch (e) { storageOk = false; mem.set(k, v); return false; }
}
function kvDel(k) {
  mem.delete(k);
  try { localStorage.removeItem(k); } catch (e) { storageOk = false; }
}
function kvKeys(prefix) {
  const keys = new Set([...mem.keys()].filter(k => k.startsWith(prefix)));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.add(k);
    }
  } catch (e) { storageOk = false; }
  return [...keys];
}
function probeStorage() {
  try { localStorage.setItem("rpg-ficha:probe", "1"); localStorage.removeItem("rpg-ficha:probe"); storageOk = true; }
  catch (e) { storageOk = false; }
}

function newId() {
  let id;
  do {
    id = (window.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  } while (kvGet(KEY_PREFIX + id) !== null);   // nunca reutiliza um id existente
  return id;
}

/* ---------- Registro do personagem ---------- */

const clampInt = (v, lo, hi) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const cleanStr = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const asTime = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : Date.now());

/* O histórico precisa ter uma entrada por nível pago de cada perícia
   (nível 1 gratuito não conta). Corrige dados antigos ou importados. */
function reconcileHistory(c, skills, saved, abil) {
  const need = {};
  // uma entrada por Perícia de Atributo/Maestria comprada (+ extras do MMA)
  const tok = new Set();
  abil.owned.forEach(id => { if (HAB[id].attr === c.id) tok.add(HAB_TOKEN + id); });
  if (c.id === "corpo" && abil.owned.includes("mma") && abil.mma.extra) tok.add(HAB_EXTRA_TOKEN);
  c.ids.forEach(id => {
    const s = skills[id];
    need[id] = s.lv <= 0 ? 0 : (s.free ? s.lv - 1 : s.lv);
  });
  const seen = {};
  const out = [];
  const seenTok = new Set();
  saved.forEach(id => {
    if (typeof id !== "string") return;
    if (tok.has(id)) { if (!seenTok.has(id)) { out.push(id); seenTok.add(id); } return; }
    if (has(need, id) && (seen[id] || 0) < need[id]) { out.push(id); seen[id] = (seen[id] || 0) + 1; }
  });
  c.ids.forEach(id => { for (let i = seen[id] || 0; i < need[id]; i++) out.push(id); });
  tok.forEach(t => { if (!seenTok.has(t)) out.push(t); });
  return out;
}

/* Perícias de Atributo/Maestria: só ids conhecidos, sem repetição; escolhas do MMA válidas. */
function sanitizeAbil(raw) {
  const out = emptyAbil();
  if (!raw || typeof raw !== "object") return out;
  const list = Array.isArray(raw.owned) ? raw.owned : [];
  list.forEach(id => {
    if (typeof id === "string" && has(HAB, id) && !out.owned.includes(id)) out.owned.push(id);
  });
  if (out.owned.includes("mma") && raw.mma && typeof raw.mma === "object") {
    out.mma.extra = raw.mma.extra === true;
    const slots = mmaSlots(out);
    const pick = (arr, kind) => {
      const keys = [];
      (Array.isArray(arr) ? arr : []).forEach(k => {
        if (typeof k === "string" && has(MMA_OPT, k) && MMA_OPT[k].kind === kind && !keys.includes(k)) keys.push(k);
      });
      return keys.slice(0, slots);
    };
    out.mma.adv = pick(raw.mma.adv, "adv");
    out.mma.dis = pick(raw.mma.dis, "dis");
  }
  return out;
}

/* Aceita qualquer objeto e devolve um registro válido (ou null). */
function sanitizeRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = {
    app: APP_ID, version: 2, id: "",
    name: cleanStr(raw.name, NAME_MAX),
    created: asTime(raw.created), updated: asTime(raw.updated),
    attrs: {}, skills: {}, history: {}, esp: {}, notes: {}, abil: emptyAbil(),
  };

  const rawAttrs = raw.attrs && typeof raw.attrs === "object" ? raw.attrs : {};
  ATTRS.forEach(k => { rec.attrs[k] = clampInt(rawAttrs[k], 0, 999); });

  const rawSkills = raw.skills && typeof raw.skills === "object" ? raw.skills : {};
  Object.keys(pState.skills).forEach(id => {
    const s = has(rawSkills, id) && rawSkills[id] && typeof rawSkills[id] === "object" ? rawSkills[id] : {};
    const isRes = id === RES_ESPIRITO;
    const lv = isRes ? 0 : clampInt(s.lv, 0, MAX_LEVEL);
    rec.skills[id] = {
      lv,
      adv: clampInt(s.adv, 0, Number.MAX_SAFE_INTEGER),
      free: !isRes && s.free === true && lv >= 1,
    };
  });
  CATEGORIES.forEach(c => {
    let n = 0;
    c.ids.forEach(id => {
      const s = rec.skills[id];
      if (s.free) { if (n >= c.free) s.free = false; else n++; }
    });
  });
  rec.abil = sanitizeAbil(raw.abil);

  CATEGORIES.forEach(c => {
    const saved = raw.history && Array.isArray(raw.history[c.id]) ? raw.history[c.id] : [];
    rec.history[c.id] = reconcileHistory(c, rec.skills, saved, rec.abil);
  });

  const e = raw.esp && typeof raw.esp === "object" ? raw.esp : {};
  rec.esp = {
    resist: e.resist === true,
    advSkill: typeof e.advSkill === "string" && has(SKILLS, e.advSkill) ? e.advSkill : null,
    ability: ABILITIES.some(a => a.id === e.ability) ? e.ability : null,
  };

  const n = raw.notes && typeof raw.notes === "object" ? raw.notes : {};
  NOTE_KEYS.forEach(k => { rec.notes[k] = cleanStr(n[k], NOTE_MAX); });
  return rec;
}

function blankRecord() {
  const rec = sanitizeRecord({});
  rec.id = newId();
  return rec;
}

/* Valores calculados guardados junto do personagem (úteis no JSON exportado).
   Ao abrir, tudo é recalculado a partir dos atributos e perícias. */
function snapshot(a, skills, abil) {
  const derived = {};
  Object.keys(DERIVED).forEach(k => { derived[k] = DERIVED[k](a); });
  derived.dano = `${a.corpo >= 3 ? 2 : 1}d4 + ${a.corpo}`;
  const points = {};
  CATEGORIES.forEach(c => {
    const total = catTotal(c, a);
    const spent = catSpent(c, skills, abil);
    points[c.id] = { total, spent, left: total - spent };
  });
  // Perícias de Atributo/Maestria compradas, com o atributo, o custo e se os requisitos estão cumpridos agora
  const ctx = { attrs: a, skills, abil };
  const habilidades = abil.owned.map(id => {
    const h = HAB[id];
    return {
      id, nome: h.name,
      tipo: h.tipo === "maestria" ? "Perícia de Maestria" : "Perícia de Atributo",
      atributo: ATTR_NAMES[h.attr], categoria: HAB_GROUP[h.group].category,
      custo: habCost(id, abil), valida: habReqsOk(id, ctx),
    };
  });
  return { derived, points, habilidades };
}

function writeRecord(rec) {
  Object.assign(rec, snapshot(rec.attrs, rec.skills, rec.abil));
  return kvSet(KEY_PREFIX + rec.id, JSON.stringify(rec));
}

function readRecord(id) {
  const raw = kvGet(KEY_PREFIX + id);
  if (raw === null) return null;
  try {
    const rec = sanitizeRecord(JSON.parse(raw));
    if (rec) rec.id = id;
    return rec;
  } catch (e) { return null; }
}

/* Estado atual da ficha → registro */
function collectRecord() {
  const rec = {
    app: APP_ID, version: 2,
    id: cur.id, name: cur.name, created: cur.created, updated: Date.now(),
    attrs: { ...attrs },
    skills: JSON.parse(JSON.stringify(pState.skills)),
    history: {},
    esp: { ...pState.esp },
    notes: { ...cur.notes },
    abil: JSON.parse(JSON.stringify(pAbil)),
  };
  CATEGORIES.forEach(c => { rec.history[c.id] = hist[c.id].slice(); });
  return rec;
}

/* Registro → estado da ficha. Substitui tudo: nada do personagem anterior sobra. */
function loadState(rec) {
  cur = { id: rec.id, created: rec.created, name: rec.name, notes: { ...rec.notes } };
  ATTRS.forEach(k => { attrs[k] = rec.attrs[k]; });
  Object.keys(pState.skills).forEach(id => { pState.skills[id] = { ...rec.skills[id] }; });
  Object.assign(pState.esp, rec.esp);
  pAbil.owned = rec.abil.owned.slice();
  pAbil.mma = { adv: rec.abil.mma.adv.slice(), dis: rec.abil.mma.dis.slice(), extra: rec.abil.mma.extra };
  habOpen.clear();
  CATEGORIES.forEach(c => { hist[c.id] = rec.history[c.id].slice(); affected[c.id] = null; });

  // Garante que o treino caiba nos pontos (dados editados à mão ou importados)
  let trimmed = false;
  CATEGORIES.forEach(c => {
    const items = enforceBudget(c);
    if (items.length) {
      trimmed = true;
      affected[c.id] = { reason: "load", from: attrs[c.id], to: attrs[c.id], lost: 0, removed: 0, items };
    }
  });
  dirty = trimmed;
}

/* ---------- Salvar ---------- */

const clock = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = ms => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function setStatus(text, kind) {
  const s = el("saveStatus");
  s.textContent = text;
  s.dataset.kind = kind || "";
}

/* soon = true agrega digitação (notas, nome); o resto grava na hora. */
function touch(soon) {
  if (!cur) return;
  dirty = true;
  if (soon) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flushSave(), 400);
  } else {
    flushSave();
  }
}

function flushSave(manual) {
  clearTimeout(saveTimer);
  if (!cur || (!dirty && !manual)) return true;
  const ok = writeRecord(collectRecord());
  if (ok) {
    dirty = false;
    setStatus(`${manual ? "Personagem salvo" : "Salvo automaticamente"} às ${clock()}.`, "ok");
  } else {
    setStatus('Não foi possível gravar no navegador (armazenamento cheio ou bloqueado). Use "Exportar JSON" para guardar uma cópia.', "err");
  }
  return ok;
}

/* ---------- Telas ---------- */

function showView(name) {
  el("menuView").hidden = name !== "menu";
  el("sheetView").hidden = name !== "sheet";
  const nm = cur && cur.name.trim();
  document.title = name === "sheet" && nm ? `${nm} · Ficha de Personagem` : "Ficha de Personagem";
  window.scrollTo(0, 0);
  el(name === "menu" ? "menu-title" : "sheet-title").focus({ preventScroll: true });
}

function resetRollBoxes() {
  document.querySelectorAll("[data-box]").forEach(box => {
    clearInterval(box._timer);
    box.classList.remove("has-roll");
    box.querySelector("[data-title]").textContent = "Nenhuma rolagem ainda";
    box.querySelector("[data-dice]").innerHTML = "";
    box.querySelector("[data-sum]").innerHTML = "";
    box.querySelector("[data-live]").textContent = "";
  });
}

function showMenuMsg(text, isErr) {
  const m = el("menuMsg");
  m.textContent = text || "";
  m.hidden = !text;
  m.classList.toggle("err", !!isErr);
}

function renderMenu() {
  const recs = kvKeys(KEY_PREFIX)
    .map(k => readRecord(k.slice(KEY_PREFIX.length)))
    .filter(Boolean)
    .sort((a, b) => b.updated - a.updated);

  el("charList").innerHTML = recs.map(r => {
    const name = r.name.trim();
    const id = esc(r.id);
    const sums = ATTRS.map(k => `<span class="t-${k}">${ATTR_NAMES[k]} <b>${r.attrs[k]}</b></span>`).join("");
    return `
      <li class="card char-item">
        <button type="button" class="char-open" data-act="open-char" data-id="${id}"
          aria-label="Abrir ${esc(name || "personagem sem nome")}">
          <span class="char-name${name ? "" : " unnamed"}">${esc(name || "Personagem sem nome")}</span>
          <span class="char-sum">${sums}</span>
          <span class="char-meta">PV ${DERIVED.pv(r.attrs)} · Atualizado em ${esc(fmtDate(r.updated))}</span>
        </button>
        <div class="char-tools">
          <button type="button" class="mini-btn" data-act="rename-char" data-id="${id}">Renomear</button>
          <button type="button" class="mini-btn" data-act="export-char" data-id="${id}">Exportar</button>
          <button type="button" class="mini-btn danger" data-act="delete-char" data-id="${id}">Excluir</button>
        </div>
      </li>`;
  }).join("");
  el("charEmpty").hidden = recs.length > 0;
  el("storageWarn").hidden = storageOk;
}

function goToMenu(msg, isErr) {
  flushSave();
  cur = null;
  dirty = false;
  showMenuMsg(msg, isErr);
  renderMenu();
  showView("menu");
}

/* ---------- Abrir, criar, renomear, excluir ---------- */

function openCharacter(id) {
  const rec = readRecord(id);
  if (!rec) {
    showMenuMsg("Não foi possível abrir este personagem: os dados estão ilegíveis.", true);
    renderMenu();
    return;
  }
  flushSave();
  closeModal();
  loadState(rec);
  el("charName").value = cur.name;
  NOTE_KEYS.forEach(k => { el(NOTE_FIELDS[k]).value = cur.notes[k]; });
  resetRollBoxes();
  setStatus("", "");
  showMenuMsg("");
  showView("sheet");
  render();
  if (dirty) flushSave();
}

function createCharacter() {
  flushSave();
  const rec = blankRecord();
  writeRecord(rec);          // grava já, para ele aparecer no menu mesmo que fique vazio
  openCharacter(rec.id);
}

function renameCharacter(id) {
  const rec = readRecord(id);
  if (!rec) return;
  openModal({
    title: "Renomear personagem",
    body: "",
    input: { label: "Novo nome", value: rec.name, placeholder: "Nome do personagem", maxLength: NAME_MAX },
    okLabel: "Salvar nome",
    onConfirm: value => {
      const fresh = readRecord(id);
      if (!fresh) return;
      fresh.name = cleanStr(value.trim(), NAME_MAX);
      writeRecord(fresh);
      showMenuMsg("");
      renderMenu();
    },
  });
}

function deleteCharacter(id) {
  const rec = readRecord(id);
  if (!rec) return;
  const name = rec.name.trim() || "Personagem sem nome";
  openModal({
    title: "Excluir personagem?",
    body: `
      <p><strong>${esc(name)}</strong> será apagado deste navegador, com seus atributos, perícias, Espírito e anotações.</p>
      <p>Esta ação não pode ser desfeita. Se quiser uma cópia, use "Exportar" antes.</p>`,
    okLabel: "Excluir",
    danger: true,
    onConfirm: () => {
      kvDel(KEY_PREFIX + id);
      showMenuMsg(`"${name}" foi excluído.`);
      renderMenu();
    },
  });
}

/* ---------- Exportar e importar (JSON) ---------- */

function downloadRecord(rec) {
  Object.assign(rec, snapshot(rec.attrs, rec.skills, rec.abil));
  const fileBase = slug(rec.name || "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "personagem";
  const blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileBase + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStored(id) {
  const rec = readRecord(id);
  if (rec) downloadRecord(rec);
}

function exportCurrent() {
  if (!cur) return;
  flushSave();
  downloadRecord(collectRecord());
}

/* Importar sempre cria personagens novos (id novo): nunca sobrescreve um existente. */
function importText(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { names: [], error: "o arquivo não é um JSON válido" }; }
  const list = Array.isArray(data) ? data : [data];
  const names = [];
  list.forEach(item => {
    if (!item || typeof item !== "object" || item.app !== APP_ID || typeof item.attrs !== "object") return;
    const rec = sanitizeRecord(item);
    if (!rec) return;
    rec.id = newId();
    rec.updated = Date.now();
    writeRecord(rec);
    names.push(rec.name.trim() || "Personagem sem nome");
  });
  return { names, error: names.length ? "" : "o arquivo não parece ser um personagem exportado por este site" };
}

async function importFiles(files) {
  const done = [];
  const errors = [];
  for (const f of files) {
    if (f.size > IMPORT_MAX_BYTES) { errors.push(`${f.name}: arquivo grande demais`); continue; }
    try {
      const r = importText(await f.text());
      if (r.error) errors.push(`${f.name}: ${r.error}`); else done.push(...r.names);
    } catch (e) { errors.push(`${f.name}: não foi possível ler o arquivo`); }
  }
  renderMenu();
  const parts = [];
  if (done.length) parts.push(`Importado${done.length > 1 ? "s" : ""}: ${done.join(", ")}.`);
  if (errors.length) parts.push(`Não importado — ${errors.join("; ")}.`);
  showMenuMsg(parts.join(" "), errors.length > 0);
}

/* ---------- Versões anteriores do site ---------- */

// Quem já usava a ficha de personagem único não perde o que tinha: vira um personagem.
function migrateLegacy() {
  if (kvGet(KEY_MIGRATED)) return;
  kvSet(KEY_MIGRATED, "1");
  if (kvKeys(KEY_PREFIX).length) return;
  try {
    const a = JSON.parse(kvGet(LEGACY_ATTRS) || "null");
    const p = JSON.parse(kvGet(LEGACY_SKILLS) || "null");
    if (!a && !p) return;
    const rec = sanitizeRecord({ name: "Personagem anterior", attrs: a || {}, skills: p && p.skills, esp: p && p.esp });
    const used = ATTRS.some(k => rec.attrs[k] > 0) ||
      Object.values(rec.skills).some(s => s.lv > 0 || s.adv > 0) ||
      rec.esp.resist || rec.esp.advSkill || rec.esp.ability;
    if (!used) return;
    rec.id = newId();
    writeRecord(rec);
  } catch (e) { /* dados antigos ilegíveis: ignora */ }
}

/* ---------- Eventos da tela de personagens ---------- */

el("createChar").addEventListener("click", createCharacter);
el("backToMenu").addEventListener("click", () => goToMenu());
el("saveNow").addEventListener("click", () => { flushSave(true); });
el("exportChar").addEventListener("click", exportCurrent);
el("importBtn").addEventListener("click", () => el("importFile").click());
el("importFile").addEventListener("change", e => {
  const files = [...e.target.files];
  e.target.value = "";
  if (files.length) importFiles(files);
});

el("charName").addEventListener("input", () => {
  if (!cur) return;
  cur.name = el("charName").value;
  touch(true);
});
el("charName").addEventListener("blur", () => flushSave());

NOTE_KEYS.forEach(k => {
  const box = el(NOTE_FIELDS[k]);
  box.addEventListener("input", () => {
    if (!cur) return;
    cur.notes[k] = box.value;
    touch(true);
  });
  box.addEventListener("blur", () => flushSave());
});

// Não perde nada ao fechar a aba ou trocar de app
window.addEventListener("pagehide", () => flushSave());
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });

/* ---------- Início ---------- */

buildPanels();
buildEspirito();
buildHabs();
el("damageCard").insertAdjacentHTML("beforeend", rollBoxHTML());
buildFx();
skillsBuilt = true;

probeStorage();
migrateLegacy();
renderMenu();
showView("menu");
