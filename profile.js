document.addEventListener("DOMContentLoaded", () => {
const supabase = window.supabase.createClient(
  "https://zzxqftnarcpjkqiztuof.supabase.co",
  "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
);

const params = new URLSearchParams(window.location.search);
const username = params.get("u");

let currentWallet = null;
let profileWallet = null;

async function init() {
  if (!username) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("username").innerText = username;

  // Restaurer le wallet depuis localStorage ou Phantom
  await restoreWallet();

  loadProfile();
}

async function restoreWallet() {
  // Vérifier si Phantom est déjà connecté
  if (window.solana && window.solana.isPhantom) {
    try {
      if (window.solana.isConnected && window.solana.publicKey) {
        currentWallet = window.solana.publicKey.toString();
        localStorage.setItem("wallet", currentWallet);
      } else {
        // Essayer de récupérer depuis localStorage
        const savedWallet = localStorage.getItem("wallet");
        if (savedWallet) {
          // Essayer une reconnexion silencieuse (sans popup)
          try {
            const res = await window.solana.connect({ onlyIfTrusted: true });
            currentWallet = res.publicKey.toString();
            localStorage.setItem("wallet", currentWallet);
          } catch (e) {
            // Si la connexion silencieuse échoue, utiliser le wallet sauvegardé
            // L'utilisateur devra se reconnecter manuellement si nécessaire
            currentWallet = savedWallet;
          }
        }
      }
    } catch (e) {
      console.log("Error restoring wallet:", e);
      // Récupérer depuis localStorage même si Phantom n'est pas encore chargé
      currentWallet = localStorage.getItem("wallet");
    }
  } else {
    // Récupérer depuis localStorage même si Phantom n'est pas encore chargé
    currentWallet = localStorage.getItem("wallet");
  }
}

async function loadProfile() {
  const { data: user } = await supabase
    .from("users")
    .select("wallet")
    .eq("username", username)
    .maybeSingle();

  if (!user) {
    document.getElementById("posts").innerHTML = '<div class="empty-state">user not found</div>';
    return;
  }

  profileWallet = user.wallet;

  const { data: statements } = await supabase
    .from("statements")
    .select("content, created_at")
    .eq("user_wallet", user.wallet)
    .order("created_at", { ascending: false });

  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_wallet", user.wallet);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_wallet", user.wallet);

  document.getElementById("followersCount").innerText = followersCount || 0;
  document.getElementById("followingCount").innerText = followingCount || 0;

  const followBtn = document.getElementById("followBtn");

  if (currentWallet && currentWallet === profileWallet) {
    followBtn.style.display = "none";
  } else if (currentWallet) {
    const { data: existingFollow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_wallet", currentWallet)
      .eq("following_wallet", profileWallet)
      .maybeSingle();

    if (existingFollow) {
      followBtn.innerText = "unfollow";
      followBtn.classList.add("following");
    } else {
      followBtn.innerText = "follow";
      followBtn.classList.remove("following");
    }

    followBtn.classList.remove("disabled");
  } else {
    followBtn.innerText = "connect wallet to follow";
    followBtn.classList.add("disabled");
  }

  const container = document.getElementById("posts");
  container.innerHTML = "";

  if (!statements || statements.length === 0) {
    container.innerHTML = '<div class="empty-state">no statements yet</div>';
    return;
  }

  statements.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <div>${p.content}</div>
      <div class="post-date">${new Date(p.created_at).toLocaleDateString()}</div>
    `;
    container.appendChild(div);
  });
}

  document.getElementById("followBtn").onclick = async () => {
    if (!currentWallet) {
      if (window.solana && window.solana.isPhantom) {
        try {
          const res = await window.solana.connect();
          currentWallet = res.publicKey.toString();
          localStorage.setItem("wallet", currentWallet);
          loadProfile();
        } catch (e) {
          alert("failed to connect wallet");
        }
      } else {
        alert("phantom wallet required");
      }
      return;
    }

    const followBtn = document.getElementById("followBtn");
    const isFollowing = followBtn.classList.contains("following");

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_wallet", currentWallet)
        .eq("following_wallet", profileWallet);
    } else {
      await supabase
        .from("follows")
        .insert({
          follower_wallet: currentWallet,
          following_wallet: profileWallet
        });
    }

    loadProfile();
  };

  document.getElementById("backBtn").onclick = () => {
    window.location.href = "index.html";
  };

  // Écouter la déconnexion de Phantom
  if (window.solana) {
    window.solana.on("disconnect", () => {
      currentWallet = null;
      localStorage.removeItem("wallet");
      loadProfile();
    });
  }

  init();
});
