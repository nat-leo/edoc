# Can I upgrade and remove the original node?

Sometimes running tests might look like below, and the import bit is to install or upgrade to new versions of node. This is a way to do so by cherry-picking the node version needed and removing the older version.

```

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

Vitest caught 1 unhandled error during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Unhandled Error ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Error: [vitest-pool]: Failed to start forks worker for test files /Users/natleo/Desktop/edocteel/edocteel/tests/hello.test.tsx.
 ❯ node_modules/vitest/dist/chunks/cli-api.B7PN_QUv.js:8046:94
 ❯ processTicksAndRejections node:internal/process/task_queues:95:5
 ❯ Pool.schedule node_modules/vitest/dist/chunks/cli-api.B7PN_QUv.js:8046:5

Caused by: Error: require() of ES Module /Users/natleo/Desktop/edocteel/edocteel/node_modules/@exodus/bytes/encoding-lite.js from /Users/natleo/Desktop/edocteel/edocteel/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.
Instead change the require of encoding-lite.js in /Users/natleo/Desktop/edocteel/edocteel/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js to a dynamic import() which is available in all CommonJS modules.
 ❯ Object.<anonymous> node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js:2:41

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_REQUIRE_ESM' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯


 Test Files  no tests
      Tests  no tests
     Errors  1 error
   Start at  11:56:48
   Duration  0ms

 FAIL  Tests failed. Watching for file changes...
       press h to show help, press q to quit
Cancelling test run. Press CTRL+c again to exit forcefully.

```

Yes — but *how* depends on how you installed Node.

## If you use nvm (most common on Macs)

`nvm` keeps multiple Node versions and you can delete the old one.

1. Install the newer one (meets your deps: **20.19.0+**):

```bash
nvm install 20.19.0
nvm use 20.19.0
node -v
```

2. Make it the default:

```bash
nvm alias default 20.19.0
```

3. Remove the old one:

```bash
nvm uninstall 20.15.0
```

## If you installed Node with Homebrew

Upgrade (it replaces the old keg; no “multiple versions” by default):

```bash
brew update
brew upgrade node
node -v
```

To confirm where Node is coming from:

```bash
which node
node -p "process.execPath"
```

If it points into `/opt/homebrew/...`, it’s Homebrew-managed.

## If you installed via the Node.pkg installer

Installing a newer pkg generally overwrites the old version, but it can leave bits behind. The cleaner approach is:

* uninstall the pkg version, or
* switch to `nvm` and ensure your shell uses the `nvm` Node first.

Check which one you’re using:

```bash
which node
```

### After upgrading Node (regardless of method)

Do a clean reinstall so native deps line up with the new Node:

```bash
rm -rf node_modules package-lock.json
npm i
npm test
```

If you paste the output of `which node`, I’ll tell you exactly which path you’re on and the best “remove old node” step for your setup.

# Some things I ran (Property of the Half-Blood Prince >:o ):

```
edocteel % nvm use 20.19.0
Now using node v20.19.0 (npm v10.8.2)
edocteel % node -v
v20.19.0
```

It's seems like uninstalling is unnecessary and setting up 20.19.0 as the default is also unnecessary if we're staying within major versions. You can see bwlow that I have three major versions of node, and my default is the least recent version I can reasonably get away with.

The update just swaps the same node version:
```
edocteel % nvm alias default 20.19.0
default -> 20.19.0 (-> v20.19.0)
```

And uninstall doesn't work because the older version got overwritten
```
edocteel % nvm uninstall 20.15.0
N/A version is not installed...
```

```
natleo@Nats-MacBook-Air-2 edocteel % nvm ls
->     v20.19.0
       v22.21.1
        v25.1.0
         system
default -> 20.19.0 (-> v20.19.0)
iojs -> N/A (default)
unstable -> N/A (default)
node -> stable (-> v25.1.0) (default)
stable -> 25.1 (-> v25.1.0) (default)
lts/* -> lts/krypton (-> N/A)
lts/argon -> v4.9.1 (-> N/A)
lts/boron -> v6.17.1 (-> N/A)
lts/carbon -> v8.17.0 (-> N/A)
lts/dubnium -> v10.24.1 (-> N/A)
lts/erbium -> v12.22.12 (-> N/A)
lts/fermium -> v14.21.3 (-> N/A)
lts/gallium -> v16.20.2 (-> N/A)
lts/hydrogen -> v18.20.8 (-> N/A)
lts/iron -> v20.20.0 (-> N/A)
lts/jod -> v22.22.0 (-> N/A)
lts/krypton -> v24.14.0 (-> N/A)
```