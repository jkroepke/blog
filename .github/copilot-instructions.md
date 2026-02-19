# Copilot repository instructions

Purpose
- Give GitHub Copilot and other automated suggestion agents enough context to make good edits, propose PRs, and run quick local validations for this Hugo-based personal blog.

Project overview
- Static site built with Hugo (see `hugo.toml`).
- Content lives under `content/`.
- Layouts and templates under `layouts/` and `partials/`.
- Static assets (images, webmanifest, favicons) under `static/` and `assets/` for SCSS or preprocessed assets.
- Generated site output is `public/` (committed in this repo). Be conservative when modifying `public/`; prefer changes to source files that generate `public/`.
- There is a `go.mod` file because some site components or theme code may use Go modules; format/verify any Go code with standard Go tooling.

Writing voice & audience
- The author persona: SRE / Cloud Architect. Write as the owner would: clean, focused, authoritative, and highly technical.
- Primary audience: engineers and operators (SREs, DevOps engineers, platform engineers, Kubernetes users). Assume readers understand basic cloud and Kubernetes concepts.
- Topics to prioritize: Kubernetes, Cloud (AWS/GCP/Azure patterns), DevOps, CI/CD, observability, security for cloud-native systems, Helm, operators, and infrastructure automation.
- Tone and style guidance for Copilot when drafting content:
  - Use clear, concise sentences. Prefer short paragraphs and bullet lists for steps or tradeoffs.
  - Be authoritative: back claims with concise reasoning, configuration examples, or references to official docs when appropriate.
  - Be technical: include concrete commands, YAML/config examples, and minimal reproducible snippets. Avoid hand-wavy statements.
  - Keep it focused: each post should have a single main idea or outcome (problem + cause + solution + caveats).
  - Assume the audience is pragmatic: include implementation notes, operational considerations, and failure modes.
  - Use code blocks for commands, configs, and small scripts. Prefer the minimal example that demonstrates the idea.
  - When suggesting infrastructure changes, include rollback or mitigation steps.

Recommended blog post structure Copilot should follow
- Title: short, descriptive, and outcome-oriented (e.g., "Reducing Kubernetes Deployment Flap with Readiness Probes").
- Summary/Lead (1–3 sentences): state the problem and the key takeaway.
- Background/Why it matters (1–2 short paragraphs): explain context and impact.
- Walkthrough (steps or explanation): include commands, YAML, and clear rationale. Use numbered steps when sequential.
- Example: provide a minimal, copy-pasteable configuration or script.
- Operational notes: monitoring, alerting, upgrade considerations, performance implications.
- Caveats & Alternatives: limitations and tradeoffs.
- Conclusion & next steps: recap and actionable next steps (links to docs or further reading).

Guidance for code and examples
- Keep examples small and runnable. For Kubernetes YAML, prefer API versions and fields valid for current stable Kubernetes (note: if unsure, state the tested Kubernetes version in the post).
- Use monospace for configuration names and code blocks for commands.
- Prefix commands with shell hints (bash/zsh) and include expected output or verification commands.
- If a post includes scripts or tools, suggest how to test them locally (e.g., `kubectl apply -f -` with a heredoc, or `kind`/`minikube` notes for local clusters).
- Cite or link to upstream docs when recommending specific flags or behaviors (e.g., link to Kubernetes docs, cloud provider docs, or Helm charts).

Editorial checks Copilot should perform before proposing a draft PR
- Verify commands and code blocks are syntactically valid (lint YAML, check shell snippets for obvious issues).
- Ensure the post has a clear one-line takeaway and that the title matches the content.
- Confirm the post includes at least one concrete example (code, YAML, command).
- Run any small reproducibility commands in a local environment where possible (e.g., validate YAML with `kubectl apply --dry-run=client -f -`).
- Recommend a short test plan for reviewers: how to reproduce the key behavior and verify the results.

What Copilot should assume
- Primary language: Hugo flavored Markdown (Goldmark) + Hugo templates; secondary: Go (for possible short utilities), SCSS/CSS, and JavaScript.
- Hugo is the primary build tool. Assume contributors will run Hugo locally to preview and build.
- The repo occasionally stores the generated `public/` directory. Prefer editing source files and then running Hugo to regenerate output. Do not directly hand-edit `public/` unless the change must be made there and cannot be generated.

Editing guidance and conventions
- Content edits: make changes under `content/` and associated `assets/` and `static/` files.
- Template edits: place structural changes under `layouts/` and `partials/`.
- Static assets: add images to `static/` or `assets/` (depending on whether they should be processed by Hugo Pipes). Optimize images where reasonable (small lossless compression) and avoid massively large images.
- CSS/SCSS: see `assets/css/_override.scss` for overrides. If adding SCSS, follow the repository's existing structure and keep imports minimal.
- Go code (if present): format with `gofmt` and run `go vet`/`go test` as applicable.
- Keep commits small and focused. Include a short, descriptive commit message and reference the area changed (e.g., content/posts, layouts/partials, assets/css).

Linting and formatting
- Markdown: run a Markdown linter if available (e.g., `markdownlint`), and ensure headings and front matter are consistent.
- HTML templates: validate template syntax by running `hugo` — template errors will surface as build failures.
- Go: `gofmt -w ./...` and `go vet ./...` (if Go files exist).
- CSS/SCSS: Prefer consistent style. If a style linter is available in CI, follow its rules.

Testing and validation checks Copilot should suggest
- After proposed changes that affect site output, run `hugo --gc --minify` and verify exit code 0.
- If a PR changes links or content heavily, run an HTML/link checker (CI/locally) to catch broken links.
- If a PR adds images, verify they are referenced correctly from `content/` or `static/` and that file sizes are reasonable.

Files and directories to treat carefully
- `public/`: generated output. Avoid manual edits. If you must change it, also change the source that generates it and document why `public/` was edited.
- `resources/_gen/` and `resources/`: generated assets by Hugo Pipes — avoid manual edits.
- `themes/`: if a theme is added/modified, prefer forking or creating small overrides in `layouts/partials`.

PR checklist Copilot should help enforce
- Changes are limited in scope and include a short description.
- Run `hugo --gc --minify` locally and confirm build success.
- For content changes: preview locally with `hugo server -D` and visually inspect the affected pages.
- Run `gofmt` and linters relevant to the changed files.
- For any added third-party assets or libraries, include a short note explaining why and the license.

Helpful commands for reviewers (quick reproduction steps)
- Clone and run a local dev server:
  - `git clone <repo> && cd blog && hugo server -D`
- Build a production preview:
  - `hugo --gc --minify && (open public/index.html || echo "open public/index.html in a browser")`

When suggesting code or file changes, Copilot should
- Prefer modifying source files over generated files.
- Provide a brief rationale in its change description or PR body.
- Include reproduction steps for reviewers when the change affects the site output.
- Keep changes minimal and reversible; avoid large unrelated refactors without prior discussion.

If uncertain about a change
- Ask for clarification in the PR description. Provide options and the tradeoffs.
- If a change affects the site build or deployment, include exact commands to validate locally.

Contact and additional context
- Repository contains an existing `README.md` which describes the blog at a high level. Use it as background context but prefer the source files (content/layouts) for current site state.

Notes for automated suggestions
- Prioritize edits that are safe and testable locally (i.e., those that can be validated by running Hugo).
- Avoid making large-scale automatic changes to `public/`, `resources/`, or `themes/` without a matching source-level change and test steps.

Hugo admonition shortcode (usage)
- The admonition shortcode supports 12 banner types to help you place notices on your page. Content inside the shortcode may be written in Markdown or HTML.

Supported banner types (12):
- `note`     — Note banner (default)
- `abstract` — Abstract banner
- `info`     — Info banner
- `tip`      — Tip banner
- `success`  — Success banner
- `question` — Question banner
- `warning`  — Warning banner
- `failure`  — Failure banner
- `danger`   — Danger banner
- `bug`      — Bug banner
- `example`  — Example banner
- `quote`    — Quote banner

Parameters
- The shortcode supports both positional and named parameters. Positional parameters follow this order:
  1. `type`  (optional) — Type of the admonition banner; default: `note`
  2. `title` (optional) — Title of the admonition banner; default: the value of `type`
  3. `open`  (optional) — Whether the content is expanded by default; default: `true`
- Named parameters are supported and recommended for clarity: `type=...`, `title=...`, `open=...`.

Usage examples
- Positional (simple):
  - {{< admonition info "Cluster note" true >}}This is an informational note.{{< /admonition >}}
- Named (recommended for clarity):
  - {{< admonition type=warning title="Migration note" open=false >}}This operation is risky; read rollback steps below.{{< /admonition >}}
- Minimal (defaults):
  - {{< admonition >}}Quick note with default `note` type and open=true.{{< /admonition >}}

Implementation note
- LoveIt CHANGED | 0.2.0: some theme versions (for example, LoveIt 0.2.0) changed the default `open` behavior; `open` defaults to `true` in those versions. If your content relies on theme-specific defaults, document the theme and version in the post.

Guidance when using admonitions
- Use `error`/`failure` for operational failures or reproducible error output; include exact commands and outputs.
- Use `warning`/`danger` for risky operations, migrations, or rollback guidance.
- Use `tip`/`success` for small optimizations or maintainer shortcuts.
- Use `quote` for short citations or community comments.
- Keep admonitions short and focused; link to longer content instead of embedding large material inside an admonition.

Example (recommended pattern for reproducible advice):

- Wrap short error blocks or actionable hints in an admonition and include the minimum reproducer.

LoveIt Theme Image Shortcode
- Prefer the `image` shortcode over standard Markdown images `![]()` or the `figure` shortcode. It supports lazy loading (`lazysizes`) and lightboxes (`lightGallery`).

Parameters:
- `src` (required): URL/path to the image.
- `alt` (optional): Alternate text (defaults to `src`).
- `caption` (optional): Image caption (supports Markdown).
- `title` (optional): Hover title.
- `src_s` (optional): Thumbnail URL.
- `src_l` (optional): HD image URL.
- `linked` (optional): `true` (default) checks if image should be hyperlinked.

Example:
{{< image src="/images/k8s-diagram.png" caption="Kubernetes Diagram" >}}

Compatibility Note
- LoveIt 0.2.10+: supports local resource references (page bundles).

Formatting Note
- Use Hugo-flavored Markdown (Goldmark).
