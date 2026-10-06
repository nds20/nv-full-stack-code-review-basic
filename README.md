# 824: Enterprise Code Review Engine

> **Your Copilot, Not Your Replacement.**

824 is an enterprise-grade, AI-powered code review engine built to remove friction from the development lifecycle. It plugs directly into your CI/CD pipeline and reviews every pull request against your standards, so your team ships faster without lowering the bar on security, compliance, or quality.

New to CI/CD? You’re in the right place. This guide takes you from zero to a working automated review in about 15 minutes, and every step explains *why* it matters.

[Read the Founder’s Legacy](#the-afs-legacy)

—

## Table of Contents

1. [What You’ll Need](#what-youll-need)
2. [Installation](#installation)
3. [How to Configure Your Environment](#how-to-configure-your-environment)
4. [Quick Start](#quick-start)
5. [CI/CD Integration](#cicd-integration)
6. [Common Friction Points](#common-friction-points)
7. [The AFS Legacy](#the-afs-legacy)

—

## What You’ll Need

Before you begin, make sure you have:

- A **GitHub account** and a repository you can push to
- **Node.js 20 or newer** (we’ll install it below)
- **Git** installed on your machine
- Your **`BEAST_LICENSE_KEY`** (provided when you sign up for 824)

Check what you already have by running these in your terminal:

```bash
node —version
git —version
```

If both print a version number, skip ahead to step 2.

—

## Installation

Follow these steps in order. Each one builds on the last.

### 1. Install Node.js

Download the **LTS** (Long-Term Support) version from [nodejs.org](https://nodejs.org) and run the installer. Then confirm it worked:

```bash
node —version
```

You should see `v20.x.x` or higher.

### 2. Clone the repository

“Cloning” downloads a copy of the project to your computer.

```bash
git clone https://github.com/<your-org>/824.git
cd 824
```

### 3. Install dependencies

Dependencies are the libraries 824 relies on. This command reads `package.json` and downloads everything for you.

```bash
npm install
```

### 4. Verify the installation

```bash
npm run review — —version
```

If you see a version number, you’re ready for the next section.

—

## How to Configure Your Environment

824 needs your license key to run. How you provide it depends on where 824 is running: on your own machine, or inside GitHub Actions.

> **Security rule #1:** Never paste your license key into your code or commit it to Git. Anyone who can see your repository could see your key.

### Option A: Running locally

1. In the root of the project, create a file named `.env`.
2. Add your key to it:

   ```
   BEAST_LICENSE_KEY=your-license-key-here
   ```

3. Make sure `.env` is listed in your `.gitignore` file so it is never committed:

   ```bash
   echo “.env” >> .gitignore
   ```

### Option B: Running in GitHub Actions (set up `BEAST_LICENSE_KEY` as a GitHub Secret)

A **GitHub Secret** is an encrypted value that only your workflows can read. It never appears in logs or source code. Here’s how to create one:

1. Open your repository on **GitHub.com**.
2. Click the **Settings** tab (top right of the repo page).
3. In the left sidebar, expand **Secrets and variables** and click **Actions**.
4. Click **New repository secret**.
5. In the **Name** field, enter exactly: `BEAST_LICENSE_KEY`
6. In the **Secret** field, paste your license key.
7. Click **Add secret**.

That’s it. The workflow in the [CI/CD Integration](#cicd-integration) section reads this secret automatically.

> **Heads up:** Secret names are case-sensitive. `BEAST_LICENSE_KEY` and `beast_license_key` are two different things. A mismatch is the most common reason a first run fails.

—

## Quick Start

Once you’ve installed 824 and set your key in `.env`, run the engine locally with a single command:

```bash
npm run review
```

824 will analyze your current changes and print its findings directly in your terminal. Use it before you push to catch issues early, long before a teammate has to.

—

## CI/CD Integration

CI/CD (Continuous Integration / Continuous Delivery) simply means your code is checked automatically every time you change it. With 824, that means every pull request gets a review without anyone lifting a finger.

### Set it up

1. Make sure you’ve completed [the GitHub Secret step](#option-b-running-in-github-actions-set-up-beast_license_key-as-a-github-secret).
2. In your repository, create the folder `.github/workflows/` if it doesn’t exist.
3. Create a file inside it named `824-review.yml`.
4. Copy and paste this exact block:

```yaml
name: 824 Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    name: Run 824
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run 824 review
        run: npm run review
        env:
          BEAST_LICENSE_KEY: ${{ secrets.BEAST_LICENSE_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

5. Commit and push the file, then open a pull request. Click the **Actions** tab to watch 824 run.

—

## Common Friction Points

Every tool has a rough edge or two. Here are the ones you’re most likely to hit, and how to clear them fast.

### `Error: Cannot find module` / `MODULE_NOT_FOUND`

This means Node.js tried to load a file or package and couldn’t find it. Work through these checks in order:

1. **Install dependencies.** The most common cause is simply skipping this step:

   ```bash
   npm install
   ```

2. **Confirm you’re in the right folder.** Commands must run from the project root (the folder containing `package.json`):

   ```bash
   pwd
   ls
   ```

   You should see `package.json` in the list. If not, `cd` into the correct folder.

3. **Verify the file path in the error message.** The error names the path Node.js was looking for. Check that it exists:

   ```bash
   ls path/from/the/error
   ```

4. **Check capitalization.** Paths are case-sensitive on Linux (which GitHub Actions uses). `Utils.js` and `utils.js` are different files, even if your laptop treats them the same.

5. **Check your Node.js version.** Older versions can fail to resolve modern packages:

   ```bash
   node —version
   ```

6. **Do a clean reinstall** if nothing else works:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### “License key not found” or authentication errors

- **Locally:** confirm `.env` exists in the project root and the line reads `BEAST_LICENSE_KEY=...` with no quotes or extra spaces.
- **In GitHub Actions:** confirm the secret is named exactly `BEAST_LICENSE_KEY` and that the workflow passes it through the `env:` block shown above.

### The workflow doesn’t appear in the Actions tab

- The file must live at `.github/workflows/` (note the leading dot) and end in `.yml` or `.yaml`.
- YAML is whitespace-sensitive. Use spaces, never tabs, and keep the indentation exactly as shown.

Still stuck? Open an issue with the full error text and the output of `node —version`. The more detail you share, the faster we can help.

—

## The AFS Legacy

824 is built on the values of **Abamonte, Foster, and Smith**, three principles that shape every decision in this tool:

- **Discipline:** Consistent standards, applied every time, with no exceptions for deadlines or convenience.
- **Structural Integrity:** Code that is sound at its foundation, because strong systems are built from the inside out.
- **Friction-Reduction:** Good tooling gets out of the way. Every step you don’t have to think about is a step toward shipping better work.

Hold yourself to a high standard, build on solid ground, and let the tool carry the weight. That’s the 824 way.
