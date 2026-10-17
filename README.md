# ditto-atlas

Public evidence index and site for **Ditto**, a PayBox plugin that copies real onchain moves for your wallet and proves they landed.

- `crawl.mjs`: the crawler, bundled from the Ditto source. Every 2 hours it reads recent real deposits into known lending markets, savings vaults and pools, then runs Ditto's checks on a 1-unit dry run (no money, no signing).
- `atlas/<chain>.json` and `atlas/meta.json` are published to GitHub Pages: https://jennycruzy.github.io/ditto-atlas/
- Nothing here can move money. The crawler only reads public chain data through an RPC key stored as an Actions secret.

Data is informational. "Passed every check" describes a simulation at one block; it is not advice or a guarantee.
