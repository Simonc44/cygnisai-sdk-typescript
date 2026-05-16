# Guide — Structure, GitHub & Publication npm

## Table des matières

1. [Structure des fichiers](#1-structure-des-fichiers)
2. [SDK Python — mise sur GitHub](#2-sdk-python--mise-sur-github)
3. [SDK TypeScript — mise sur GitHub](#3-sdk-typescript--mise-sur-github)
4. [Publier le SDK TypeScript sur npm](#4-publier-le-sdk-typescript-sur-npm)
5. [Automatiser avec GitHub Actions](#5-automatiser-avec-github-actions)
6. [Checklist avant chaque release](#6-checklist-avant-chaque-release)

---

## 1. Structure des fichiers

### SDK Python (`cygnisai-sdk-python`)

```
cygnisai_sdk_python/
├── cygnisai_sdk_python/       ← package Python importable
│   ├── __init__.py            ← point d'entrée public (configure, GenerativeModel, …)
│   ├── client.py              ← client HTTP async (httpx) + gestion des erreurs + retry
│   ├── models.py              ← modèles Pydantic v2 (ChatRequest, ChatResponse, …)
│   ├── _logo.py               ← logo ASCII (usage interne)
│   └── py.typed               ← marqueur PEP 561 (le package est typé)
├── tests/
│   ├── __init__.py
│   └── test_client.py         ← tests pytest-asyncio + pytest-httpx
├── pyproject.toml             ← métadonnées du package + dépendances + config pytest/mypy
├── README.md
└── LICENCE
```

**Rôle de chaque fichier clé :**

| Fichier | Rôle |
|---|---|
| `__init__.py` | Exporte l'API publique. C'est ce que l'utilisateur importe. Contient aussi `configure()`. |
| `client.py` | Toute la logique HTTP : envoi de requêtes, parsing SSE, retry exponentiel, mapping des codes HTTP en exceptions typées. |
| `models.py` | Schémas Pydantic validés à l'exécution. Garantit que les données envoyées/reçues sont conformes. |
| `pyproject.toml` | Standard moderne (PEP 517/518). Remplace `setup.py`. Déclare les dépendances, la version, les classifiers PyPI. |

---

### SDK TypeScript (`cygnisai-sdk`)

```
cygnisai_sdk_typescript/
├── src/
│   ├── index.ts               ← point d'entrée : re-exporte tout + fonction configure()
│   ├── client.ts              ← CygnisAIClient (fetch natif, retry, streaming SSE)
│   ├── generative.ts          ← GenerativeModel, GenerativeResponse, GenerativeStreamResponse
│   ├── types.ts               ← interfaces TypeScript (ChatRequest, ChatResponse, …)
│   └── errors.ts              ← hiérarchie d'exceptions (CygnisAIError et sous-classes)
├── tests/
│   ├── client.test.ts         ← tests Vitest pour le client bas niveau
│   └── generative.test.ts     ← tests Vitest pour GenerativeModel
├── dist/                      ← généré par `npm run build` (ne pas versionner)
│   ├── index.js               ← build ESM
│   ├── index.cjs              ← build CommonJS
│   └── index.d.ts             ← types TypeScript
├── package.json               ← métadonnées npm, scripts, dépendances dev
├── tsconfig.json              ← config TypeScript (strict, NodeNext)
├── tsup.config.ts             ← config du bundler tsup (ESM + CJS dual output)
├── vitest.config.ts           ← config du framework de test Vitest
├── .gitignore
└── README.md
```

**Rôle de chaque fichier clé :**

| Fichier | Rôle |
|---|---|
| `src/index.ts` | Unique point d'entrée du package. Re-exporte les classes/types et définit `configure()`. |
| `src/client.ts` | `CygnisAIClient` : fetch avec timeout, retry exponentiel, parsing SSE, mapping HTTP → exceptions. |
| `src/generative.ts` | `GenerativeModel` : interface haut niveau identique au SDK Python. Gère le client global. |
| `src/types.ts` | Toutes les interfaces TypeScript. Importables séparément par les utilisateurs du SDK. |
| `src/errors.ts` | `CygnisAIError` + `AuthenticationError`, `RateLimitError`, `ServerError`, `NetworkError`, `ResponseValidationError`. |
| `tsup.config.ts` | Compile `src/` en `dist/index.js` (ESM) + `dist/index.cjs` (CJS) + `dist/index.d.ts` (types). |
| `package.json` → `"exports"` | Déclare le dual-package : `import` → ESM, `require` → CJS. Indispensable pour la compatibilité Node/bundlers. |

---

## 2. SDK Python — mise sur GitHub

### Étape 1 — Créer le dépôt GitHub

1. Aller sur [github.com/new](https://github.com/new)
2. Nom du dépôt : `cygnisai-sdk-python`
3. Visibilité : **Public**
4. Ne pas initialiser avec un README (vous avez déjà le vôtre)
5. Cliquer **Create repository**

### Étape 2 — Pousser le code

```bash
cd cygnisai_sdk_python

git init
git add .
git commit -m "feat: initial release v1.0.0"

git remote add origin https://github.com/Simonc44/cygnisai-sdk-python.git
git branch -M main
git push -u origin main
```

### Étape 3 — Créer un tag de version

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Étape 4 — Créer une Release GitHub

1. Aller dans l'onglet **Releases** du dépôt
2. Cliquer **Draft a new release**
3. Choisir le tag `v1.0.0`
4. Titre : `v1.0.0 — Initial release`
5. Décrire les changements
6. Cliquer **Publish release**

### Installation depuis GitHub (sans PyPI)

```bash
pip install git+https://github.com/Simonc44/cygnisai-sdk-python.git
# ou une version spécifique :
pip install git+https://github.com/Simonc44/cygnisai-sdk-python.git@v1.0.0
```

> **Pour publier sur PyPI plus tard**, créer un compte sur [pypi.org](https://pypi.org), puis :
> ```bash
> pip install build twine
> python -m build
> twine upload dist/*
> ```

---

## 3. SDK TypeScript — mise sur GitHub

### Étape 1 — Créer le dépôt GitHub

1. Aller sur [github.com/new](https://github.com/new)
2. Nom : `cygnisai-sdk-typescript`
3. Visibilité : **Public**
4. Ne pas initialiser avec un README

### Étape 2 — Pousser le code

```bash
cd cygnisai_sdk_typescript

git init
git add .
git commit -m "feat: initial release v1.0.0"

git remote add origin https://github.com/Simonc44/cygnisai-sdk-typescript.git
git branch -M main
git push -u origin main
```

### Étape 3 — Vérifier que `dist/` est ignoré

Le fichier `.gitignore` contient déjà `dist/`. Le dossier de build ne doit **jamais** être versionné — il sera généré automatiquement à la publication npm.

### Étape 4 — Créer un tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 4. Publier le SDK TypeScript sur npm

### Étape 1 — Créer un compte npm

1. Aller sur [npmjs.com](https://www.npmjs.com/) → **Sign Up**
2. Vérifier votre e-mail
3. Activer l'**authentification à deux facteurs (2FA)** — obligatoire pour publier

### Étape 2 — Se connecter en local

```bash
npm login
# Suivre les instructions (username, password, OTP 2FA)
```

### Étape 3 — Vérifier `package.json`

S'assurer que ces champs sont corrects :

```json
{
  "name": "cygnisai-sdk",
  "version": "1.0.0",
  "files": ["dist", "README.md", "LICENCE"]
}
```

> **Le champ `"name"`** est le nom public du package. Vérifier qu'il n'existe pas déjà sur npm :
> ```bash
> npm search cygnisai-sdk
> ```
> Si le nom est pris, utilisez un **scope** : `"name": "@simonc44/cygnisai-sdk"`

### Étape 4 — Builder et tester

```bash
npm install          # installer les devDependencies
npm run build        # compile src/ → dist/
npm run typecheck    # vérifier les types TypeScript
npm test             # lancer Vitest
```

Tous les tests doivent passer avant de publier.

### Étape 5 — Prévisualiser ce qui sera publié

```bash
npm pack --dry-run
```

Cela liste les fichiers qui seront inclus dans le package. Vérifier que `dist/` y figure et que `node_modules/` n'y est pas.

### Étape 6 — Publier

```bash
npm publish --access public
```

> L'option `--access public` est **obligatoire** si vous utilisez un scope (`@simonc44/cygnisai-sdk`). Sans scope, elle est facultative.

### Étape 7 — Vérifier la publication

```bash
npm info cygnisai-sdk
```

Le package est maintenant installable par tout le monde :

```bash
npm install cygnisai-sdk
```

---

## 5. Automatiser avec GitHub Actions

Créer le fichier `.github/workflows/publish.yml` dans le dépôt TypeScript pour **publier automatiquement sur npm à chaque nouveau tag** :

```yaml
name: Publish to npm

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # nécessaire pour npm provenance

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Publish
        run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Configurer le secret `NPM_TOKEN` :**

1. Sur [npmjs.com](https://www.npmjs.com/) → votre profil → **Access Tokens** → **Generate New Token** → type **Automation**
2. Copier le token généré
3. Dans GitHub → Settings du dépôt → **Secrets and variables** → **Actions** → **New repository secret**
4. Nom : `NPM_TOKEN`, valeur : le token copié

**Workflow de release :**

```bash
# Mettre à jour la version
npm version patch   # 1.0.0 → 1.0.1
# ou
npm version minor   # 1.0.0 → 1.1.0
# ou
npm version major   # 1.0.0 → 2.0.0

# Pousser le commit ET le tag automatiquement créés par npm version
git push && git push --tags
# → GitHub Actions se déclenche et publie sur npm
```

---

## 6. Checklist avant chaque release

### SDK Python

- [ ] `version` mis à jour dans `pyproject.toml`
- [ ] Tests passent : `pytest tests/ -v`
- [ ] Pas d'erreurs mypy : `mypy cygnisai_sdk_python/`
- [ ] `CHANGELOG` ou release notes rédigés
- [ ] Tag Git créé et poussé

### SDK TypeScript

- [ ] `version` mis à jour dans `package.json`
- [ ] Build propre : `npm run build`
- [ ] Types corrects : `npm run typecheck`
- [ ] Tests passent : `npm test`
- [ ] `npm pack --dry-run` montre les bons fichiers
- [ ] Tag Git créé (`npm version patch|minor|major`)
- [ ] Push du tag → GitHub Actions publie automatiquement
