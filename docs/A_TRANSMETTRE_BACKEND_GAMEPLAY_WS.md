# Contrat backend à implémenter — gameplay WebSocket et synchronisation du pseudo

## Pourquoi cette évolution est nécessaire

Le flipper est virtuel : Three.js/Rapier détecte les collisions dans le playfield. Les ESP32 servent aux contrôleurs et aux solénoïdes, ils ne détectent pas les bumpers.

Le backend doit rester autoritaire : le front envoie uniquement un événement brut (`target_hit` ou `ball_lost`), puis le backend calcule score/combo/vies, met Redis à jour, archive l'événement et rebroadcast le résultat aux trois écrans.

Le front est déjà prêt à émettre et consommer le contrat décrit ci-dessous.

## 1. Messages entrants sur le WebSocket borne

Connexion utilisée :

```text
WS /ws?borne_id=flipper-cabinet-1
```

### Impact sur une cible

```json
{
  "type": "game:event",
  "eventId": "mabc123-1",
  "event": "target_hit",
  "targetId": "Bump",
  "occurredAt": 1782240000000
}
```

### Perte de bille

```json
{
  "type": "game:event",
  "eventId": "mabc456-2",
  "event": "ball_lost",
  "occurredAt": 1782240000700
}
```

Le client ne transmet volontairement ni score final, ni combo, ni nombre de vies : ces valeurs doivent être calculées par le backend.

## 2. Validation obligatoire

Pour chaque `game:event` :

1. retrouver la borne depuis `borne_id` ;
2. récupérer `borne.active_session_id` ;
3. charger la session Redis ;
4. accepter l'événement uniquement si `session.status == PLAYING` ;
5. vérifier que `eventId`, `event`, `occurredAt` et `targetId` ont le bon type ;
6. dédupliquer `eventId` dans Redis avec le même TTL que la session ;
7. ignorer silencieusement les doublons, événements périmés ou événements reçus pendant READY/PAUSED/OVER.

Ne jamais accepter un nombre de points fourni par le navigateur.

## 3. Barème autoritaire côté backend

```python
TARGET_RULES = {
    "Slingshot_triangle": (150, "SLINGSHOT"),
    "Planet_Glace": (500, "PLANET"),
    "Planet_Terre": (500, "PLANET"),
    "Planet_Volcan": (500, "PLANET"),
    "Bump": (750, "BUMP"),
    "Champignion_a": (350, "SPINNER"),
    "Champignion_b": (350, "SPINNER"),
    "Rampe": (250, "RAMP"),
    "Ramp_2": (250, "RAMP"),
}
```

Pour `target_hit` :

```python
session.combo = min(session.combo + 1, 9)
awarded_points = base_points * session.combo
session.score += awarded_points
```

Puis mettre à jour Redis et broadcaster :

```json
{
  "type": "score:update",
  "score": 2250,
  "combo": 3,
  "bonusType": "BUMP"
}
```

Archiver également l'événement dans `EventBuffer`. Pour rester compatible avec la persistance actuelle, utiliser le topic interne `flipper/bumper/hit` et mettre `awarded_points` dans `payload.points`.

## 4. Perte de bille et fin naturelle

Pour `ball_lost` :

```python
session.lives = max(0, session.lives - 1)
session.combo = 0
```

Mettre à jour Redis, archiver avec le topic interne `flipper/ball/lost`, puis broadcaster :

```json
{ "type": "ball:lost", "livesRemaining": 2 }
```

Quand `lives == 0`, le backend doit immédiatement :

1. passer la session à `OVER` ;
2. broadcaster `{ "type": "game:over", "finalScore": session.score }` ;
3. broadcaster `{ "type": "match:state", "status": "over", "sessionId": "..." }` ;
4. passer la navigation borne à `game_over` ;
5. appeler le flux existant `FinishBorneGameUseCase` / `FinishAndPersistUseCase` pour persister Player, Game et GameEvents.

## 5. Snapshot nécessaire pour le pseudo et les reconnexions

Le payload `PLAYERS_VALIDATED` envoyé par le front contient déjà :

```json
{
  "pseudo": "ABC#HETIC",
  "mode": "solo",
  "players": ["ABC#HETIC"]
}
```

Après normalisation/création de session, le backend doit broadcaster sur le bus borne :

```json
{
  "type": "session:snapshot",
  "sessionId": "uuid-session",
  "players": ["ABC#HETIC"],
  "mode": "solo",
  "status": "ready",
  "score": 0,
  "combo": 0,
  "lives": 3
}
```

Ce snapshot doit être envoyé :

- immédiatement après la création de session ;
- au client qui ouvre/reconnecte un `WS ?borne_id=...` lorsqu'une session est active.

Le front l'utilise déjà pour hydrater `gameStore`, afficher le pseudo sur le backglass, initialiser le DMD et restaurer score/combo/vies après reconnexion.

## 6. Navigation leaderboard

Ajouter la transition backend suivante si elle n'existe pas :

```text
game_over + OPEN_LEADERBOARD -> leaderboard
```

Le leaderboard front lit ensuite les données persistées via `GET /leaderboard`.

## 7. Tests d'acceptation backend

- `target_hit` en PLAYING met Redis à jour et diffuse le même score au playfield, backglass et DMD ;
- le même `eventId` reçu deux fois ne compte qu'une fois ;
- un `targetId` inconnu est ignoré ;
- les événements sont ignorés pendant READY, PAUSED et OVER ;
- `ball_lost` décrémente une seule vie et remet le combo à zéro ;
- la dernière bille déclenche `ball:lost`, `game:over`, `match:state: over`, la navigation et la persistance SQL ;
- une reconnexion reçoit `nav:state` puis `session:snapshot` avec pseudo et valeurs live ;
- `OPEN_LEADERBOARD` depuis Game Over fonctionne après la persistance ;
- les anciens événements MQTT continuent de fonctionner sans double comptage.

## Hors périmètre

Le mode 1v1 structuré reste hors périmètre. Le contrat utilise déjà `players: []` pour pouvoir l'étendre plus tard sans casser le solo.
