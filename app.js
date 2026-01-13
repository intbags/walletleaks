document.addEventListener("DOMContentLoaded", () => {

  // ---------- SUPABASE ----------
  let supabase = null;
  try {
    supabase = window.supabase.createClient(
      "https://zzxqftnarcpjkqiztuof.supabase.co",
      "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
    );
  } catch (e) {
    console.error("supabase failed", e);
  }

  // ---------- DOM ----------
  const connectBtn = document.getElementById("connectBtn");
  const publishBtn = document.getElementById("publishBtn");
  const usernameInput = document.getElementById("usernameInput");
  const statementInput = document.getElementById("statementInput");
  const statusEl = document.getElementById("status");
  const feedEl = document.getElementById("feed");

  let wallet = null;

  // ---------- CONNECT ----------
  connectBtn.onclick = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      alert("phantom required");
      return;
    }

    try {
      const res = await window.solana.connect();
      wallet = res.publicKey.toString();

      connectBtn.innerText = "wallet connected";
      connectBtn.classList.add("disabled");
      publishBtn.classList.remove("disabled");

    } catch (e) {
      console.error(e);
    }
  };

  // ---------- PUBLISH ----------
  publishBtn.onclick = async () => {
    if (!wallet) {
      statusEl.innerText = "connect wallet first";
      return;
    }

    const username = usernameInput.value.trim();
    const text = statementInput.value.trim();

    if (!username.startsWith("@") || !text) {
      statusEl.innerText = "invalid input";
      return;
    }

    try {
      statusEl.innerText = "signing…";

      // 🔥 THIS WAS MISSING
      const message = `statement:${text}\nwallet:${wallet}`;
      const encoded = new TextEncoder().encode(message);
      const signed = await window.solana.signMessage(encoded, "utf8");

      const sig = btoa(
        String.fromCharCode(...signed.signature)
      );

      statusEl.innerText = "publishing…";

      if (supabase) {
        await supabase.from("users").upsert({
          wallet,
          username
        });

        await supabase.from("statements").insert({
          user_wallet: wallet,
          content: text,
          signature: sig
        });
      }

      statusEl.innerText = "statement published";
      statementInput.value = "";

      loadFeed();

    } catch (e) {
      console.error(e);
      statusEl.innerText = "publish failed";
    }
  };

  // ---------- FEED (SILENT, UI-SAFE) ----------
  async function loadFeed() {
    if (!supabase || !feedEl) return;

    const { data } = await supabase
      .from("statements")
      .select("content, created_at, users(username)")
      .order("created_at", { ascending: false })
      .limit(10);

    feedEl.innerHTML = "";

    data.forEach(p => {
      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <a href="profile.html?u=${p.users.username}">
          ${p.users.username}
        </a>
        <div>${p.content}</div>
      `;
      feedEl.appendChild(el);
    });
  }

  loadFeed();
});
