/**
 * Codeberg issue 5: the composed mode stacked hyphenated line ends, seven in a row in the first paragraph of the delibera specimen. Chromium's print gives no oracle here, since Chromium does not support `hyphenate-limit-lines` (`CSS.supports` answers false on Chromium 153, so the declaration never reaches computed style); the case holds the Compositor to its own limit, no more than three hyphenated lines in a row, across a sweep of measures.
 *
 * @remarks
 * Measured 2026-11-07 on the delibera specimen in its own fonts: the longest run went from 7 to 3 and the hyphens from 13 to 10, the interword space averaging 1.333 of the natural space before and 1.356 after (standard deviation 0.250 and 0.247, the widest unchanged at 2.191). The paragraph below is that paragraph's text, set here in the browser's default sans-serif.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `hyphen-at-the-cut.browser.ts`, whose server this repeats.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { ciceroEngine } from '../../seam/index.ts';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const assets = ciceroEngine.vendorAssets();
const PREFIX = '/_beltype/';
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
let browser: Browser;

before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url ?? '/', 'http://x').pathname;
    const respond = (body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) return respond(docs.get(name.slice(5)) as string, 'text/html');
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const file = (assets.files as Record<string, string>)[rest];
      const dir = rest.startsWith('cicero/seam/') ? ['cicero/seam/', 'seam/'] : rest.startsWith('cicero/src/') ? ['cicero/src/', 'src/'] : null;
      const found = file ?? (dir ? path.join(dist, dir[1] as string, rest.slice((dir[0] as string).length)) : null);
      if (found && fs.existsSync(found)) return respond(fs.readFileSync(found), TYPES[path.extname(found)] ?? 'application/octet-stream');
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const PARA = "L\u2019Assessora della Difesa dell\u2019Ambiente riferisce che En.A.S. - l\u2019Ente acque della Sardegna (di seguito proponente) ha presentato, in data 11.11.2024 (prot. D.G.A. n.&nbsp;33195 di pari data), e regolarizzato, in data 5.12.2024 (prot. D.G.A. n.&nbsp;36294 di pari data), presso il Servizio Valutazione impatti e incidenze ambientali (di seguito Servizio V.I.A.), l\u2019istanza di Verifica di assoggettabilit\u00e0 alla V.I.A. per l\u2019intervento denominato \u201cProgetto della Minicentrale idroelettrica sulla diga del Liscia\u201d in territorio del Comune di Luras (SS), ascrivibile al punto&nbsp;2 lett.&nbsp;h) \u201cimpianti per la produzione di energia idroelettrica con potenza nominale di concessione superiore a 100&nbsp;kW e, per i soli impianti idroelettrici che rientrano nella casistica di cui all\u2019articolo&nbsp;166 del presente decreto ed all\u2019articolo&nbsp;4, punto&nbsp;3.b, lettera&nbsp;i) del decreto del Ministro dello sviluppo economico del 6&nbsp;luglio 2012, pubblicato nel supplemento ordinario alla Gazzetta Ufficiale n.&nbsp;159 del 10&nbsp;luglio 2012, con potenza nominale di concessione superiore a 250&nbsp;kW\u201d, dell\u2019Allegato&nbsp;IV alla parte seconda del vigente D.Lgs. n.&nbsp;152/2006. L\u2019intervento, il cui importo stimato \u00e8 pari a euro 5&nbsp;Mln, finanziato con fondi assegnati con la deliberazione della Giunta regionale n.&nbsp;38/27 del 26.9.2019, prevede il revamping dell\u2019impianto idroelettrico localizzato, in dx idraulica, a valle della diga sul fiume Liscia, in localit\u00e0 Calamaiu nel comune di Luras (SS). Il progetto consiste nel recupero, strutturale e architettonico, dei locali che ospitano l\u2019esistente centrale idroelettrica (mai entrata in esercizio), al fine di consentire l\u2019installazione di tre nuovi gruppi idroelettrici, in grado di turbinare la massima portata transitabile nel canale, ai piedi dello sbarramento, pari a 7,2&nbsp;m\u00b3/s. La produzione di energia elettrica attesa \u00e8 di 4.921&nbsp;MWh/anno. In relazione alla legge regionale 5.12.2024, n.&nbsp;20, recante \u201cMisure urgenti per l\u2019individuazione di aree e superfici idonee e non idonee all\u2019installazione e promozione di impianti a fonti di energia rinnovabile (FER) e per la semplificazione dei procedimenti autorizzativi\u201d, l\u2019intervento in esame, finalizzato all\u2019autoconsumo, \u00e8 ammissibile in quanto ricade in un\u2019area idonea (rif. punto&nbsp;10 dell\u2019Allegato&nbsp;F).";
const LIMIT = 3;

/** The longest run of hyphenated line ends the composed mode set in the paragraph: every line it chose ends on one of its breaks, and a break that shows a hyphen stands after the hyphen it wrote. */
async function longestRun(width: number) {
  const key = `delibera-${width}`;
  docs.set(key, `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
@page { size: A4; margin: 20mm; }
html { font: 11pt/1.5 sans-serif; hyphens: auto; } body { margin: 0; } p { margin: 0; text-align: justify; width: ${width}mm; }
</style></head><body><p>${PARA}</p></body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate(() => (window as any).__beltypeCicero.run({ composed: true }));
  const ends = await page.evaluate(() => [...document.querySelectorAll('p br[data-beltype~="break"]')].map((br) => br.previousSibling?.nodeType === 3 && (br.previousSibling as Text).data === '\u2010'));
  await page.context().close();
  let best = 0;
  let run = 0;
  for (const hyphen of ends) best = Math.max(best, (run = hyphen ? run + 1 : 0));
  return { best, lines: ends.length };
}

test(`the composed mode ends no more than ${LIMIT} lines in a row on a hyphen (Codeberg issue 5)`, async () => {
  const seen: Record<number, number> = {};
  for (let width = 150; width <= 158; width += 2) {
    const { best, lines } = await longestRun(width);
    assert.ok(lines > 10, `the paragraph is composed at ${width}mm: ${lines} breaks`);
    seen[width] = best;
  }
  assert.ok(Object.values(seen).every((n) => n <= LIMIT), `longest run by measure: ${JSON.stringify(seen)}`);
});
