const analyzeBtn = document.getElementById("analyzeBtn");
const addressInput = document.getElementById("addressInput");
const loadingEl = document.getElementById("loading");
const resultEl = document.getElementById("result");
const verdictEl = document.getElementById("verdict");
const shareBtn = document.getElementById("shareBtn");

const RPC_URL = "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

analyzeBtn.onclick = async () => {
  const address = addressInput.value.trim();
  if (!address) return;

  resultEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  try {
    await sleep(900);

    const balance = await rpc("getBalance", [address]);
    const sigs = await rpc("getSignaturesForAddress", [address, { limit: 500 }]);
    const tokens = await rpc("getTokenAccountsByOwner", [
      address,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: "jsonParsed" }
    ]);

    const sol = balance?.value / 1e9 || 0;
    const tx = sigs?.length || 0;
    const tokenCount = tokens?.value?.length || 0;

    const verdict = computeVerdict(sol, tx, tokenCount);

    verdictEl.innerText = verdict;

    loadingEl.classList.add("hidden");
    resultEl.classList.remove("hidden");

    shareBtn.onclick = () => {
      const text = `walletleaks says my solana wallet is: "${verdict}"`;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        "_blank"
      );
    };

  } catch (e) {
    loadingEl.classList.add("hidden");
    alert("unable to analyze wallet");
  }
};

function computeVerdict(sol, tx, tokens) {
  if (tx > 500 && tokens > 20) return "likely degen trader";
  if (tokens > 50 && sol < 2) return "airdrop farmer";
  if (tx < 10 && sol > 20) return "long-term holder";
  if (tx > 200 && sol < 0.5) return "high-frequency grinder";
  if (tx < 5 && sol > 5) return "inactive but funded wallet";
  if (tx < 20 && tokens < 3) return "low on-chain footprint";
  return "generic solana participant";
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
