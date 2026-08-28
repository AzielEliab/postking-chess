# Post-King Chess — iPhone & Android

Local-first Flutter client. Board UI, Witness / Steward / Remain,
Philosophy screen with the motto:

> The goal is not to win. The goal is to remain.

Human has a king. AI has a node. Offline. No analytics.

Application id: `com.azieeliab.postkingchess`

## Rules kernel

Tiny Dart chess in `lib/chess/board.dart`, ported from the desktop
stdlib kernel. **Subset:** no en passant, queen-only promotion, no
50-move or threefold draw. White may castle. Black cannot. Continuity
Collapse uses clusters + influence streak + 1-ply restore (full M-ply
search is desktop-only). Documented in the Philosophy screen.

## Open in Android Studio / Xcode

The `android/` and `ios/` folders here are skeleton READMEs because
this tree was written without the Flutter SDK on PATH.

```bash
cd mobile
flutter create --org com.azieeliab --project-name postking_chess .
flutter pub get
flutter run
```

Then open `android/` in Android Studio, or `ios/Runner.xcworkspace` in
Xcode.

## Desktop package (counted download)

This phone app does not replace the desktop package.

# → https://postking-download-tracker.vibelock.workers.dev/ ←

GitHub: https://github.com/AzielEliab/postking-chess

**Forks are welcome and always allowed.**
