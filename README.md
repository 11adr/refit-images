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
importa il repo su Vercel (preset *Other*); `vercel.json` serve la radice del repo.

## Sviluppo

```sh
./build.sh                          # ricompila caire.wasm (serve Go >= 1.22)
python3 -m http.server    # apri http://localhost:8000
```

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `index.html`, `app.js`, `worker.js`, `style.css`, `caire.wasm` | sito statico |
| `wasm/main.go` | ponte JS ⇄ Go (`caireResize`) |
| `wasm/caire/` | copia del nucleo di caire, adattata per WASM |

## Modifiche rispetto a caire

Il codice in `wasm/caire/` deriva da caire (MIT). Differenze: rimossi GUI (Gio), CLI e canali globali che nel browser non servono; stato globale azzerato a ogni elaborazione; callback di avanzamento al posto del canale di preview; cicli interni ottimizzati (Sobel, blur, aggiunta/rimozione seam) con risultato identico all'originale, circa 4–5 volte più veloci.

## Licenza

MIT, come caire. Copyright (c) 2018 Endre Simo, vedi [LICENSE](LICENSE).
