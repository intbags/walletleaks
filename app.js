document.addEventListener("DOMContentLoaded", () => {

  // ---------- SUPABASE ----------
  let supabase = null;
  try {
    supabase = window.supabase.createClient(
      "https://zzxqftnarcpjkqiztuof.supabase.co",
      "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
    );
  } catch (e) {
    console.error("supabase error", e);
  }

  // ---------- DOM ----------
  const connectBtn = document.getElementById("connectBtn");
  const publishBtn = document.getElementById("publishBtn");
  const statementInput = document.getElementById("statementInput");
  const statusEl = document.getElementById("status");
  const feedEl = document.getElementById("feed");
  const heroSection = document.getElementById("heroSection");
  const publishCard = document.getElementById("publishCard");

  const usernameModal = document.getElementById("usernameModal");
  const modalUsernameInput = document.getElementById("modalUsernameInput");
  const confirmUsernameBtn = document.getElementById("confirmUsernameBtn");
  const usernameStatus = document.getElementById("usernameStatus");

  const commentsModal = document.getElementById("commentsModal");
  const commentsContainer = document.getElementById("commentsContainer");
  const commentInput = document.getElementById("commentInput");
  const submitCommentBtn = document.getElementById("submitCommentBtn");
  const closeCommentsBtn = document.getElementById("closeCommentsBtn");

  let wallet = null;
  let currentUsername = null;
  let currentStatementId = null;

  // ---------- RESTORE WALLET ----------
  async function restoreWallet() {
    // Vérifier si Phantom est déjà connecté
    if (window.solana && window.solana.isPhantom) {
      try {
        if (window.solana.isConnected && window.solana.publicKey) {
          wallet = window.solana.publicKey.toString();
          localStorage.setItem("wallet", wallet);
        } else {
          // Essayer de récupérer depuis localStorage
          const savedWallet = localStorage.getItem("wallet");
          if (savedWallet) {
            // Essayer une reconnexion silencieuse (sans popup)
            try {
              const res = await window.solana.connect({ onlyIfTrusted: true });
              wallet = res.publicKey.toString();
              localStorage.setItem("wallet", wallet);
            } catch (e) {
              // Si la connexion silencieuse échoue, utiliser le wallet sauvegardé
              // L'utilisateur devra se reconnecter manuellement si nécessaire
              wallet = savedWallet;
            }
          }
        }
      } catch (e) {
        console.log("Error restoring wallet:", e);
        // Récupérer depuis localStorage en dernier recours
        wallet = localStorage.getItem("wallet");
      }
    } else {
      // Récupérer depuis localStorage même si Phantom n'est pas encore chargé
      wallet = localStorage.getItem("wallet");
    }

    if (wallet) {
      connectBtn.classList.add("disabled");
      publishBtn.classList.remove("disabled");
      heroSection.classList.add("hidden");

      const { data } = await supabase
        .from("users")
        .select("username")
        .eq("wallet", wallet)
        .maybeSingle();

      if (data) {
        currentUsername = data.username;
      }
    }
  }

  // ---------- CONNECT ----------
  connectBtn.onclick = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      alert("phantom required");
      return;
    }

    const res = await window.solana.connect();
    wallet = res.publicKey.toString();
    localStorage.setItem("wallet", wallet);

    connectBtn.classList.add("disabled");
    publishBtn.classList.remove("disabled");
    heroSection.classList.add("hidden");

    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!data) {
      modalUsernameInput.value = "@";
      usernameModal.classList.remove("hidden");
    } else {
      currentUsername = data.username;
    }

    loadFeed();
  };

  // ---------- USERNAME INPUT ----------
  modalUsernameInput.oninput = async () => {
    let val = modalUsernameInput.value;

    if (!val.startsWith("@")) {
      val = "@" + val.replace(/@/g, "");
    }

    modalUsernameInput.value = val;

    const u = val.trim();

    if (u.length < 4) {
      usernameStatus.innerText = "min 3 characters (without @)";
      confirmUsernameBtn.classList.add("disabled");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("wallet")
      .eq("username", u)
      .maybeSingle();

    if (data) {
      usernameStatus.innerText = "username taken";
      confirmUsernameBtn.classList.add("disabled");
    } else {
      usernameStatus.innerText = "username available";
      confirmUsernameBtn.classList.remove("disabled");
    }
  };

  modalUsernameInput.onkeydown = (e) => {
    const pos = e.target.selectionStart;
    if (pos === 0 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
    }
  };

  modalUsernameInput.onclick = (e) => {
    if (e.target.selectionStart === 0) {
      e.target.setSelectionRange(1, 1);
    }
  };

  // ---------- CONFIRM USERNAME ----------
  confirmUsernameBtn.onclick = async () => {
    if (confirmUsernameBtn.classList.contains("disabled")) return;

    const u = modalUsernameInput.value.trim();

    await supabase.from("users").insert({
      wallet,
      username: u
    });

    currentUsername = u;
    usernameModal.classList.add("hidden");
  };

  // ---------- PUBLISH ----------
  publishBtn.onclick = async () => {
    if (!wallet) return;

    const text = statementInput.value.trim();
    if (!text) return;

    statusEl.innerText = "signing…";

    const msg = `statement:${text}\nwallet:${wallet}`;
    const encoded = new TextEncoder().encode(msg);
    const signed = await window.solana.signMessage(encoded, "utf8");

    const sig = btoa(
      String.fromCharCode(...signed.signature)
    );

    statusEl.innerText = "publishing…";

    await supabase.from("statements").insert({
      user_wallet: wallet,
      content: text,
      signature: sig
    });

    statusEl.innerText = "statement published";
    statementInput.value = "";

    loadFeed();
  };

  // ---------- LIKES ----------
  async function toggleLike(statementId) {
    if (!wallet) {
      alert("connect wallet to like");
      return;
    }

    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("statement_id", statementId)
      .eq("user_wallet", wallet)
      .maybeSingle();

    if (existingLike) {
      await supabase
        .from("likes")
        .delete()
        .eq("id", existingLike.id);
    } else {
      await supabase.from("likes").insert({
        statement_id: statementId,
        user_wallet: wallet
      });
    }

    loadFeed();
  }

  // ---------- COMMENTS MODAL ----------
  closeCommentsBtn.onclick = () => {
    commentsModal.classList.add("hidden");
    currentStatementId = null;
  };

  submitCommentBtn.onclick = async () => {
    if (!wallet) {
      alert("connect wallet to comment");
      return;
    }

    const text = commentInput.value.trim();
    if (!text) return;

    await supabase.from("comments").insert({
      statement_id: currentStatementId,
      user_wallet: wallet,
      content: text
    });

    commentInput.value = "";
    loadComments(currentStatementId);
  };

  async function openComments(statementId) {
    currentStatementId = statementId;
    commentsModal.classList.remove("hidden");
    loadComments(statementId);
  }

  async function loadComments(statementId) {
    const { data: comments } = await supabase
      .from("comments")
      .select("id, user_wallet, content, created_at")
      .eq("statement_id", statementId)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: false });

    const wallets = [...new Set(comments?.map(c => c.user_wallet) || [])];
    let userMap = {};

    if (wallets.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("wallet, username")
        .in("wallet", wallets);

      users?.forEach(u => {
        userMap[u.wallet] = u.username;
      });
    }

    commentsContainer.innerHTML = "";

    if (!comments || comments.length === 0) {
      commentsContainer.innerHTML = '<div class="empty-comments">no replies yet</div>';
      return;
    }

    comments.forEach(comment => {
      const username = userMap[comment.user_wallet] || "@unknown";
      const commentEl = document.createElement("div");
      commentEl.className = "comment";
      commentEl.innerHTML = `
        <div class="comment-author">
          <a href="profile.html?u=${encodeURIComponent(username)}">${username}</a>
        </div>
        <div class="comment-text">${comment.content}</div>
        <div class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</div>
      `;
      commentsContainer.appendChild(commentEl);
    });
  }

  // ---------- FEED ----------
  async function loadFeed() {
    const { data: statements } = await supabase
      .from("statements")
      .select("id, content, created_at, user_wallet")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!statements || statements.length === 0) {
      feedEl.innerHTML = '<div class="empty-state">no statements yet. be the first to publish.</div>';
      return;
    }

    const statementIds = statements.map(s => s.id);
    const wallets = [...new Set(statements.map(s => s.user_wallet))];

    const { data: users } = await supabase
      .from("users")
      .select("wallet, username")
      .in("wallet", wallets);

    const { data: likes } = await supabase
      .from("likes")
      .select("statement_id, user_wallet")
      .in("statement_id", statementIds);

    const { data: commentCounts } = await supabase
      .from("comments")
      .select("statement_id")
      .in("statement_id", statementIds);

    const userMap = {};
    users.forEach(u => {
      userMap[u.wallet] = u.username;
    });

    const likeMap = {};
    likes?.forEach(like => {
      if (!likeMap[like.statement_id]) {
        likeMap[like.statement_id] = { count: 0, liked: false };
      }
      likeMap[like.statement_id].count++;
      if (wallet && like.user_wallet === wallet) {
        likeMap[like.statement_id].liked = true;
      }
    });

    const commentCountMap = {};
    commentCounts?.forEach(comment => {
      commentCountMap[comment.statement_id] = (commentCountMap[comment.statement_id] || 0) + 1;
    });

    feedEl.innerHTML = "";

    statements.forEach(p => {
      const username = userMap[p.user_wallet] || "@unknown";
      const likeData = likeMap[p.id] || { count: 0, liked: false };
      const commentCount = commentCountMap[p.id] || 0;

      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <div class="post-header">
          <a href="profile.html?u=${encodeURIComponent(username)}">${username}</a>
        </div>
        <div class="post-content">${p.content}</div>
        <div class="post-date">${new Date(p.created_at).toLocaleDateString()}</div>
        <div class="post-actions">
          <button class="post-action-btn like-btn ${likeData.liked ? 'liked' : ''}" data-statement-id="${p.id}">
            ♥ ${likeData.count}
          </button>
          <button class="post-action-btn comment-btn" data-statement-id="${p.id}">
            💬 ${commentCount}
          </button>
        </div>
      `;

      el.querySelector(".like-btn").onclick = (e) => {
        e.preventDefault();
        toggleLike(p.id);
      };

      el.querySelector(".comment-btn").onclick = (e) => {
        e.preventDefault();
        openComments(p.id);
      };

      feedEl.appendChild(el);
    });
  }

  // Écouter la déconnexion de Phantom
  if (window.solana) {
    window.solana.on("disconnect", () => {
      wallet = null;
      localStorage.removeItem("wallet");
      connectBtn.classList.remove("disabled");
      publishBtn.classList.add("disabled");
      heroSection.classList.remove("hidden");
      currentUsername = null;
    });
  }

  // Charger le feed immédiatement
  loadFeed();

  // Restaurer le wallet au chargement (en arrière-plan)
  restoreWallet().then(() => {
    // Recharger le feed après restauration pour mettre à jour les likes
    loadFeed();
  }).catch(() => {
    // Même en cas d'erreur, le feed est déjà chargé
  });
});
