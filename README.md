# Ditto Atlas

**The live data and website behind Ditto, a PayBox plugin that lets your AI assistant put your crypto to work by copying what real people did today, safely, with your approval, and with proof it worked.**

Every 2 hours it looks at where real people put their money on the blockchain, runs Ditto's safety checks on each place, and publishes the results. The website shows them, explains any transaction you paste in, and lists every real Ditto run with its receipts.

Website: https://ditto-atlas.vercel.app · Plugin code: https://github.com/Jennycruzy/ditto · Demo: https://github.com/Jennycruzy/ditto/releases/download/demo-video/ditto-demo.mp4

## What's in here

- `crawl.mjs`: the crawler, bundled from the Ditto source. Every 2 hours it reads recent real deposits into known lending markets, savings vaults and pools, then runs Ditto's checks on a 1-unit dry run (no money, no signing).
- `atlas/<chain>.json` and `atlas/meta.json` are published to GitHub Pages: https://jennycruzy.github.io/ditto-atlas/
- Nothing here can move money. The crawler only reads public chain data through an RPC key stored as an Actions secret.

Data is informational. "Passed every check" describes a simulation at one block; it is not advice or a guarantee.
