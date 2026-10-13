# Refit Images

Adatta le immagini senza deformarle. Interfaccia web basata su [caire](https://github.com/esimov/caire) di Endre Simo: ridimensionamento *content-aware* (seam carving) delle immagini, **interamente nel browser del visitatore**. Nessun server, nessun upload: il motore Go è compilato in WebAssembly e gira in un Web Worker.

## Funzioni

- Riduzione e ingrandimento di larghezza e/o altezza senza deformare il soggetto
- Pennelli **Proteggi** (zone da conservare) e **Rimuovi** (zone da eliminare per prime)
- Riconoscimento volti opzionale (pigo, incluso in caire)
- Soglia bordi e sfocatura regolabili, barra di avanzamento, annulla
- Export PNG / JPG / WebP, tema chiaro/scuro, utilizzabile da mobile

## Deploy su Vercel

Il sito è statico e `caire.wasm` è già compilato nel repo, quindi non serve alcuna build:
importa il repo su Vercel (preset *Other*); `vercel.json` aggiunge solo l'header del file `.wasm`.

## Sviluppo

Il sito è statico: `python3 -m http.server` nella radice e apri http://localhost:8000.

### Motore (Go)

Il codice Go che produce `caire.wasm` non è nel ramo `main` (Vercel lo scambierebbe per un server Go), ma resta nel tag `engine-source`:

```sh
git checkout engine-source -- wasm            # ripristina la cartella wasm/
cd wasm
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o ../caire.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../wasm_exec.js   # stessa versione di Go
cd .. && git rm -rf --cached wasm && rm -rf wasm               # prima di committare
```

Serve Go >= 1.22. Contenuto di `wasm/`: `main.go` (ponte JS ⇄ Go, `caireResize`) e `caire/` (copia del nucleo di caire adattata per WASM).

## Struttura

| File | Ruolo |
| --- | --- |
| `index.html`, `style.css`, `app.js` | interfaccia |
| `worker.js` | Web Worker che carica ed esegue il motore |
| `caire.wasm`, `wasm_exec.js` | motore caire compilato in WebAssembly |

## Modifiche rispetto a caire

Il codice nel tag `engine-source` (`wasm/caire/`) deriva da caire (MIT). Differenze: rimossi GUI (Gio), CLI e canali globali che nel browser non servono; stato globale azzerato a ogni elaborazione; callback di avanzamento al posto del canale di preview; cicli interni ottimizzati (Sobel, blur, aggiunta/rimozione seam) con risultato identico all'originale, circa 4–5 volte più veloci.

## Licenza

MIT, come caire. Copyright (c) 2018 Endre Simo, vedi [LICENSE](LICENSE).
