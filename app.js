// =====================
// SUPABASE CONFIG
// =====================
const SUPABASE_URL = "https://zzxqftnarcpjkqiztuof.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// =====================
// DOM
// =====================
let wallet = null;

const connectBtn = document.getElementById("connectBtn");
const publishBtn = document.getElementById("publishBtn");
const statusEl = document.getElementById("status");
const statementInput = document.getElementById("statementInput");
const usernameBox = document.getElementById("usernameBox");
const usernameInput = document.getElementById("usernameInput");

// =====================
// CONNECT WALLET
// =====================
connectBtn.onclick = async () => {
  if (!window.solana || !window.solana.isPhantom) {
    alert("phantom wallet required");
    return;
  }

  const res = await window.solana.connect();
  wallet = res.publicKey.toString();

  connectBtn.innerText = "wallet connected";
  connectBtn.classList.add("disabled");

  usernameBox.classList.remove("hidden");
  publishBtn.classList.remove("disabled");
};

// =====================
// PUBLISH STATEMENT
// =====================
publishBtn.onclick = async () => {
  const text = statementInput.value.trim();
  const username = usernameInput.value.trim();

  if (!wallet) {
    statusEl.innerText = "connect wallet first";
    return;
  }

  if (!username.startsWith("@") || username.length < 3) {
    statusEl.innerText = "invalid username";
    return;
  }

  if (!text) {
    statusEl.innerText = "write a statement";
    return;
  }

  try {
    statusEl.innerText = "signing...";

    const message = `statement:${text}\nwallet:${wallet}`;
    const encoded = new TextEncoder().encode(message);
    const signed = await window.solana.signMessage(encoded, "utf8");

    const signatureBase64 = btoa(
      String.fromCharCode(...signed.signature)
    );

    statusEl.innerText = "saving...";

    // 1️⃣ upsert user
    await supabase.from("users").upsert({
      wallet: wallet,
      username: username
    });

    // 2️⃣ insert statement
    const { error } = await supabase.from("statements").insert({
      user_wallet: wallet,
      content: text,
      signature: signatureBase64
    });

    if (error) throw error;

    statusEl.innerText = "statement published";

    setTimeout(() => {
      window.location.href = `/@${username}`;
    }, 800);

  } catch (err) {
    console.error(err);
    statusEl.innerText = "failed to publish";
  }
};
