const analyzeBtn = document.getElementById("analyzeBtn");
const addressInput = document.getElementById("addressInput");
const loadingEl = document.getElementById("loading");
const resultEl = document.getElementById("result");
const verdictEl = document.getElementById("verdict");
const shareBtn = document.getElementById("shareBtn");

const RPC_PRIMARY = "https://api.mainnet-beta.solana.com";
const RPC_FALLBACK = "https://mainnet.helius-rpc.com/?api-key=b5dce25c-09db-45bd-ba9b-d2e2f16fc841";

const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

analyzeBtn.onclick = async () => {
  const address = addressInput.value.trim();

  if (!isValidSolanaAddress(address)) {
    alert("invalid solana address");
    return;
  }

  resultEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  let sol = 0;
  let tx = 0;
  let tokens = 0;

  try {
    await sleep(700);

    // balance (critical)
    const balanceRes = await rpcSafe("getBalance", [address]);
    sol = balanceRes?.value ? balanceRes.value / 1e9 : 0;

    // tx count (non critical)
    try {
      const sigs = await rpcSafe("getSignaturesForAddress", [
        address,
        { limit: 300 }
      ]);
      tx = sigs?.length || 0;
    } catch {
      tx = 0;
    }

    // token accounts (non critical)
    try {
      const tokenRes = await rpcSafe("getTokenAccountsByOwner", [
        address,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed" }
      ]);
      tokens = tokenRes?.value?.length || 0;
    } catch {
      tokens = 0;
    }

    const verdict = computeVerdict(sol, tx, tokens);
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
    console.error(e);
    loadingEl.classList.add("hidden");
    alert("rpc unavailable. try again.");
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

// -------- RPC WITH FALLBACK --------
async function rpcSafe(method, params) {
  try {
    return await rpcCall(RPC_PRIMARY, method, params);
  } catch {
    return await rpcCall(RPC_FALLBACK, method, params);
  }
}

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
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

// -------- HELPERS --------
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
