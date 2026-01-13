// =====================
// SAFE BOOT
// =====================
document.addEventListener("DOMContentLoaded", () => {
  console.log("app loaded");

  // =====================
  // CHECK DEPENDENCIES
  // =====================
  if (!window.supabase) {
    console.error("supabase not loaded");
    return;
  }

  // =====================
  // SUPABASE
  // =====================
const SUPABASE_URL = "https://zzxqftnarcpjkqiztuof.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  // =====================
  // DOM ELEMENTS
  // =====================
  const connectBtn = document.getElementById("connectBtn");
  const publishBtn = document.getElementById("publishBtn");
  const statusEl = document.getElementById("status");
  const statementInput = document.getElementById("statementInput");
  const usernameBox = document.getElementById("usernameBox");
  const usernameInput = document.getElementById("usernameInput");

  if (!connectBtn) {
    console.error("connectBtn not found");
    return;
  }

  let wallet = null;

  // =====================
  // CONNECT WALLET
  // =====================
  connectBtn.onclick = async () => {
    console.log("connect clicked");

    if (!window.solana) {
      alert("no solana wallet detected");
      return;
    }

    if (!window.solana.isPhantom) {
      alert("phantom wallet required");
      return;
    }

    try {
      const res = await window.solana.connect({ onlyIfTrusted: false });
      wallet = res.publicKey.toString();

      connectBtn.innerText = "wallet connected";
      connectBtn.classList.add("disabled");

      usernameBox.classList.remove("hidden");
      publishBtn.classList.remove("disabled");

      statusEl.innerText = "wallet connected";

    } catch (e) {
      console.error(e);
      statusEl.innerText = "connection cancelled";
    }
  };

  // =====================
  // PUBLISH
  // =====================
  publishBtn.onclick = async () => {
    if (!wallet) {
      statusEl.innerText = "connect wallet first";
      return;
    }

    const text = statementInput.value.trim();
    const username = usernameInput.value.trim();

    if (!username.startsWith("@")) {
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

      await supabase.from("users").upsert({
        wallet: wallet,
        username: username
      });

      const { error } = await supabase.from("statements").insert({
        user_wallet: wallet,
        content: text,
        signature: signatureBase64
      });

      if (error) throw error;

      statusEl.innerText = "statement published";

    } catch (err) {
      console.error(err);
      statusEl.innerText = "failed to publish";
    }
  };
});

  // =====================
  // FEED
  // =====================

async function loadFeed() {
  const { data, error } = await supabase
    .from("statements")
    .select("content, created_at, user_wallet")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return;

  const feed = document.createElement("div");
  feed.className = "feed";

  data.forEach(s => {
    const el = document.createElement("div");
    el.className = "post";
    el.innerHTML = `
      <div class="post-content">${s.content}</div>
      <div class="post-meta">${s.user_wallet.slice(0,6)}...</div>
    `;
    feed.appendChild(el);
  });

  document.querySelector(".app").appendChild(feed);
}

loadFeed();
