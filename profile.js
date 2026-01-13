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
  
  // S'assurer que currentWallet est défini
  if (!currentWallet) {
    await restoreWallet();
  }

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
  } else if (currentWallet && profileWallet) {
    followBtn.style.display = "block";
    
    try {
      const { data: existingFollow, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_wallet", currentWallet)
        .eq("following_wallet", profileWallet)
        .maybeSingle();

      if (error) {
        console.error("Error checking follow status:", error);
      }

      if (existingFollow) {
        followBtn.innerText = "unfollow";
        followBtn.classList.add("following");
        followBtn.classList.remove("disabled");
      } else {
        followBtn.innerText = "follow";
        followBtn.classList.remove("following");
        followBtn.classList.remove("disabled");
      }

      followBtn.disabled = false;
      followBtn.style.pointerEvents = "auto";
    } catch (error) {
      console.error("Error in loadProfile follow check:", error);
      followBtn.innerText = "follow";
      followBtn.classList.remove("following");
      followBtn.classList.remove("disabled");
      followBtn.disabled = false;
      followBtn.style.pointerEvents = "auto";
    }
  } else {
    followBtn.innerText = "connect wallet to follow";
    followBtn.classList.add("disabled");
    followBtn.disabled = true;
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
          await restoreWallet();
          await loadProfile();
        } catch (e) {
          alert("failed to connect wallet");
        }
      } else {
        alert("phantom wallet required");
      }
      return;
    }

    if (!profileWallet) {
      alert("Profile wallet not found");
      return;
    }

    const followBtn = document.getElementById("followBtn");
    const isFollowing = followBtn.classList.contains("following");

    // Désactiver le bouton pendant l'opération
    followBtn.disabled = true;
    followBtn.style.pointerEvents = "none";

    try {
      if (isFollowing) {
        // Unfollow
        const { data, error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_wallet", currentWallet)
          .eq("following_wallet", profileWallet)
          .select();
        
        if (error) {
          console.error("Error unfollowing:", error);
          alert(`Failed to unfollow: ${error.message}`);
          followBtn.disabled = false;
          followBtn.style.pointerEvents = "auto";
          return;
        }
      } else {
        // Follow - vérifier que les deux wallets existent dans users
        const { data: followerExists } = await supabase
          .from("users")
          .select("wallet")
          .eq("wallet", currentWallet)
          .maybeSingle();

        const { data: followingExists } = await supabase
          .from("users")
          .select("wallet")
          .eq("wallet", profileWallet)
          .maybeSingle();

        if (!followerExists) {
          alert("Your wallet is not registered. Please set a username first.");
          followBtn.disabled = false;
          followBtn.style.pointerEvents = "auto";
          return;
        }

        if (!followingExists) {
          alert("The profile you're trying to follow doesn't exist.");
          followBtn.disabled = false;
          followBtn.style.pointerEvents = "auto";
          return;
        }

        const { data, error } = await supabase
          .from("follows")
          .insert({
            follower_wallet: currentWallet,
            following_wallet: profileWallet
          })
          .select();
        
        if (error) {
          console.error("Error following:", error);
          if (error.code === "23505") {
            // Duplicate key error - already following
            console.log("Already following, refreshing...");
          } else {
            alert(`Failed to follow: ${error.message}`);
            followBtn.disabled = false;
            followBtn.style.pointerEvents = "auto";
            return;
          }
        }
      }

      // Réactiver le bouton et recharger le profil
      followBtn.disabled = false;
      followBtn.style.pointerEvents = "auto";
      
      // Attendre un peu pour que la base de données se mette à jour
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Recharger le profil pour mettre à jour le bouton
      await loadProfile();
    } catch (error) {
      console.error("Error:", error);
      followBtn.disabled = false;
      followBtn.style.pointerEvents = "auto";
      alert(`An error occurred: ${error.message}`);
    }
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
