# fxManager in-game resource

F6 opens the quick menu. F7 opens the panel. Players without staff permissions can access their own reports; staff sections follow the configured ACE permissions.

## Reports

- Submit with **F7 → Reports → New report**, or `/report your description`.
- Players can see and reply to their own reports. Staff with `fxmanager.reports.view` can see the full queue.
- Replies to other players require `fxmanager.reports.reply`; status changes require `fxmanager.reports.close`.
- Reports support Open, In progress, and Resolved states, threaded replies, search, and filtering. Resolved reports must be reopened before replying.
- Reports persist in the existing panel database. The queue shows the latest 100 accessible reports and each conversation shows its latest 200 messages.
- New reports are limited to one per 30 seconds per connection. Replies are limited to one per second.

## Player monitoring

**F7 → Players → World monitoring** exposes tags and blips. Monitoring requires `fxmanager.game.players`.

Tags appear above other streamed players within 150 metres, not your own character. They show a server ID, name, armour value, health bar, and speaking indicator. Blips distinguish on-foot, vehicle, and dead players in your routing bucket.


Displayed health subtracts GTA’s 100-point offset and clamps at zero (200 → 100, 150 → 50). The player roster includes health, armour, vehicle state, ping, and routing bucket. Moderation actions still require their individual kick, ban, or warn permissions.

## Development

From the repository root:

```powershell
bun install
bun run --cwd apps/resource build
bun run --cwd apps/resource web:dev
```

The resource build uses the installed `@overextended/fx-utils`. The core supplies the resource API token and API port. Restart through the manager so those runtime settings are restored correctly.
