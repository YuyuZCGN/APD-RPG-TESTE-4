# Ficha de Personagem

Interactive character creation sheet and character manager for a tabletop RPG. Plain HTML, CSS and JavaScript, with no dependencies and no build step. Dark fantasy / post-apocalyptic theme, responsive for desktop and mobile.

## Characters

- The site opens on a **starting menu** listing every saved character (name, attribute summary, PV and last update), newest first, with a **Criar Novo Personagem** button at the bottom.
- Click a character to open its sheet. Each character is fully independent: attributes, Perícias, Advantage counters, Espírito options, notes and name never mix.
- On a sheet, **← Personagens** returns to the menu without losing anything.
- From the menu you can **rename**, **export** or **delete** a character. Deleting asks for confirmation.
- A new character starts with every attribute at 0, every Perícia untrained and empty text boxes.

### Saving

- Everything is saved automatically to the browser (`localStorage`) on every change; text is saved a moment after you stop typing, and also when you close or leave the tab.
- **Salvar Personagem** forces a save and shows the time of the last one.
- Each character lives under its own unique id, so saving or importing can never overwrite another character.
- Saved data is per browser and per site address. Clearing site data erases it, so use **Exportar JSON** for backups.
- **Exportar JSON** downloads one character as a file; **Importar JSON** (in the menu) loads one or more exported files as **new** characters, so an import never replaces an existing one. Files are validated and sanitized, so a bad or edited file can't break the sheet.
- The exported file also contains the calculated values (derived statistics, damage die, Pontos de Perícia), for reference. They are recomputed when the character is opened.
- If you used an earlier single-character version of this site, its data is moved into a character called "Personagem anterior" the first time this version opens.

## Attributes and derived statistics

- Four attributes (Corpo, Mente, Persona, Espírito) start at 0. There is no point limit; they can't go below 0.
- Derived statistics update instantly:

| Statistic | Formula |
| --- | --- |
| Defesa | ceil(2 + Corpo × 1.5) |
| Esquiva | ceil(2 + Mente × 2) |
| Pontos de Vida (PV) | 14 + Corpo × 6 |
| Pontos de Ação (PA) | Corpo × 12 |
| Valor de Especialização (VE) | 2 + Mente × 2 |
| Deslocamento | 5 + Corpo × 1.5 meters |

- Dado de Dano: 1d4 + Corpo for Corpo 0–2, 2d4 + Corpo from Corpo 3 up, with its own roll button.

## Perícias and Pontos de Perícia

- Corpo, Mente and Persona each have their own panel, their own pool of Pontos de Perícia, training levels (0–5, bonus = level) and a roll button per Perícia. **The pools are never shared.** Espírito gives no Pontos de Perícia.
- Cost: level 0 → 1 costs 1 point, every later level costs 2.
- Points **accumulate** per attribute level (e.g. Corpo 3 = 4 + 4 + 5 = 13). Unspent points stay available when you raise any attribute, and raising one attribute never touches another one's points. Above 5 an attribute gives no extra points.
- Free trained Perícias (Corpo 2, Mente 3, Persona 2) are chosen with the ★ Grátis button: they start at level 1 at no cost.

### Lowering an attribute

- The Pontos de Perícia granted by the removed attribute level are removed from that attribute's pool.
- If the training no longer fits, the **most recent purchases are removed first** (last in, first out) and only as many as needed. Training bought with points from lower attribute levels is kept whenever possible.
- A red notice (below the attributes and in the affected panel) lists exactly which Perícias lost levels, and those rows are highlighted. Consecutive reductions merge into one notice (for example Corpo 3 → 1). Raising the attribute again returns the points but does not restore removed training. Dismiss the notice with ×.

### Resets

- **Redefinir atributos** sets all attributes to 0 and, through the rule above, removes the paid training they funded. Free picks, Advantage counters and Espírito options stay.
- **Redefinir perícias** clears all training, free picks and Advantage counters. Attributes and Espírito options stay.
- Both open a confirmation window that explains what will change. **Confirmar** is disabled for 5 seconds and counts down ("Confirmar (5)" … "Confirmar (0)"). Cancel (button, Esc or clicking outside) closes it at any time, and nothing is changed until you confirm. The countdown restarts every time the window opens.

## Rolls and Advantage

- Normal check: 1d8 + Perícia bonus, with a dice animation.
- Every Perícia has an Advantage counter. It can't go below 0 and has **no upper limit**. With Advantage (any value above 0) the check always rolls 2d8, keeps the highest and adds the bonus; both dice are shown and the kept one is marked.
- The Espírito resistance check uses the Espírito value as its bonus.

## Espírito

- Option A: Advantage in Fortitude and Espírito checks.
- Option B: pick one Perícia to receive Advantage.
- Option C: pick one special ability (selectable boxes, one at a time).

## Perícias de Atributo e Perícias de Maestria

Duas seções no **fim da ficha** (depois das Anotações), na ordem: Atributo: Corpo (Perícia de Luta) → Maestria: Corpo (Lutas de Maestria) → Atributo: Mente (Perícias de Teoria) → Maestria: Mente (Maestrias Mentais) → Atributo: Persona (Perícias de Carisma). **Persona não tem Perícias de Maestria.**

- Cada Perícia de Atributo custa **2** Pontos de Perícia; cada Perícia de Maestria custa **3**. O custo sai do pool do atributo correspondente (o mesmo pool do treino das Perícias do atributo). Nunca fica negativo.
- Cada Perícia é uma caixa expansível: o cabeçalho mostra nome, custo e estado (Disponível, Bloqueada, Comprada, Inválida); ao tocar, aparecem a descrição completa e os requisitos (✓/✗). Requisitos não cumpridos ficam sempre visíveis e o botão Comprar fica desativado.
- **Requisitos são validados na lógica** (`buyHab` recusa a compra mesmo fora do botão) e rechecados a cada mudança de atributo ou treino. Se um requisito for perdido depois da compra, a Perícia **não é apagada**: fica marcada como *temporariamente inválida* (efeitos suspensos) até o requisito voltar.
- Não dá para comprar a mesma Perícia duas vezes. **Remover** devolve os pontos.
- Se um atributo diminuir e os pontos deixarem de bastar, as compras mais recentes (treino e Perícias, juntos) saem primeiro, como já acontecia com o treino, e o aviso vermelho lista tudo.
- **Redefinir perícias** e **Redefinir atributos** também removem essas compras (pontos devolvidos). **Redefinir habilidades** remove só elas. Os três usam a confirmação de 5 segundos.
- **MMA**: exige conhecer 4 Perícias de Luta válidas e não pode ser usado com Krav Maga ou Sanda (e vice-versa). Depois de comprado, abre uma interface para escolher 2 vantagens e 2 desvantagens **das lutas que você conhece**, sempre em número igual (escolha a desvantagem correspondente antes da próxima vantagem). Dá para pagar 3 pontos extras por +1 vantagem e +1 desvantagem. Aumentos de dado de dano e de nível de dano acumulam no máximo 2 de cada. Itens de luta que misturam bônus e penalidade (ex.: Boxe: esquiva +2 e Defesa −2) aparecem separados em vantagem e desvantagem no MMA.
- Salvo por personagem (`abil` no registro): Perícias compradas, escolhas do MMA e pontos extras. O JSON exportado também traz `habilidades` (atributo, tipo, custo e se os requisitos estão cumpridos no momento).

## Notes

Three text boxes at the bottom of each sheet, saved with the character: **Habilidades**, **Habilidades de Atributo** and **Anotações pessoais**. They support multiple lines and can be resized or scrolled.

## Visual identity

Corpo is red (glow), Mente blue (floating particles), Persona purple (floating "!") and Espírito grey (fog). Effects are CSS-only and switch off when the device asks for reduced motion.

## Publish on GitHub Pages

1. Create a repository and upload `index.html`, `style.css`, `habilidades.js`, `script.js` and `README.md` to the root.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. The site will be live at `https://<your-user>.github.io/<repo-name>/`.

## Changing the rules

The Perícias de Atributo/Maestria (texts, requirements, MMA options) are in `habilidades.js`; their logic is in the "PERÍCIAS DE ATRIBUTO E PERÍCIAS DE MAESTRIA" block of `script.js`.


The rules are at the top of `script.js`: `DERIVED` holds the formulas. The Perícias tables (`CATEGORIES`: skill lists, free picks and point gains per attribute level) and the Espírito abilities (`ABILITIES`) are in the Perícias block further down. If you change a formula, also update the description shown under that statistic in `index.html`.
