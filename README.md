# ⚽ Borgoretti

Web app (PWA) per gestire le partite di calcetto del lunedì: giocatori, squadre,
gol e assist in diretta, storico, classifiche e statistiche "tipo Opta".
Funziona offline e si installa sul telefono come un'app.

## Struttura

```
index.html          pagina principale
manifest.json       dati per l'installazione come app
sw.js               service worker (funzionamento offline)
css/style.css       grafica (tema campo da calcio, chiaro/scuro)
icons/              icone dell'app
js/app.js           avvio, router e gestione eventi
js/db.js            salvataggio dati (IndexedDB nel browser)
js/stats.js         motore delle statistiche
js/charts.js        grafici SVG (senza librerie)
js/ui.js            componenti: pannelli, conferme, avvisi, animazioni
js/sync.js          predisposizione per la sincronizzazione online futura
js/demo.js          dati di esempio
js/views/*.js       una file per ogni schermata
```

## Come funziona

- **Giornata** = il lunedì. Con 2 squadre c'è una partita secca; con 3-4 squadre
  la serata è un mini-torneo di sfide (3 punti vittoria, 1 pareggio).
- Ogni giornata salva una **copia** delle squadre di quel giorno: se cambi le rose
  abituali, le partite passate non cambiano.
- **Presenze** = giornate giocate. **Partite giocate** = sfide disputate.
- **Punteggio classifica** = Gol×3 + Assist×2 + Vittorie×3 + Pareggi×1 + Presenze×1
  (pesi modificabili in Impostazioni).
- **Forma** = ultime 5 presenze: 60% risultati + 40% gol e assist. 🔥 ogni 20 punti.

## Pubblicare su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `borgoretti`), pubblico.
2. "Add file" → "Upload files": trascina **tutto il contenuto** della cartella
   (index.html, manifest.json, sw.js e le cartelle css, js, icons). Poi "Commit changes".
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, cartella `/ (root)` → Save.
4. Dopo 1-2 minuti l'app è su `https://<tuo-utente>.github.io/borgoretti/`.
5. Dal telefono (Chrome) apri il link → menu ⋮ → "Installa app" / "Aggiungi a schermata Home".

## Aggiornare l'app

Quando modifichi i file, in `sw.js` aumenta `VERSION` (es. `v1.0.1`) così il
telefono scarica la nuova versione.

## Dati

I dati restano sul dispositivo (IndexedDB). Fai backup periodici da
Impostazioni → "Scarica backup completo" e conservali (es. su Google Drive).
Puoi esportare in CSV per Excel e ripristinare un backup su un altro telefono.
