# GitHub Actions workflow à activer manuellement

Le token GitHub utilisé pour pousser ce code n'a pas le scope `workflow`.
**Action manuelle requise (3 minutes) :**

## Étapes

1. Ouvre `.github-workflows-pending/lighthouse-sync.yml` ci-contre
2. Crée le fichier dans GitHub UI à l'emplacement `.github/workflows/lighthouse-sync.yml` :
   - Va sur https://github.com/Walilarabi/PMS-V500-NEW-DESIGN
   - Onglet "Code" → bouton "Add file" → "Create new file"
   - Tape `.github/workflows/lighthouse-sync.yml` comme nom
   - Colle le contenu du YAML
   - Commit directement sur main (ou sur feat/rms-mvp-phase1)
3. Supprime le dossier `.github-workflows-pending/` (devenu inutile)

## Ou bien

Si tu as un token avec le scope `workflow`, tu peux faire :
```bash
git mv .github-workflows-pending/lighthouse-sync.yml .github/workflows/lighthouse-sync.yml
git commit -m "ci: activate lighthouse sync workflow"
git push
```

## Pourquoi cette friction ?

GitHub bloque la modification des workflows par un token sans le scope
`workflow` — c'est une protection contre les attaques supply chain. Normal.
