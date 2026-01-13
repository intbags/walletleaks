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

async function updateFollowCounts() {
  if (!profileWallet) return;
  
  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_wallet", profileWallet);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_wallet", profileWallet);

  document.getElementById("followersCount").innerText = followersCount || 0;
  document.getElementById("followingCount").innerText = followingCount || 0;
}

async function loadProfile() {
  const { data: user } = await supabase
    .from("users")
    .select("wallet, avatar_url")
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

  // Charger et afficher l'avatar
  const avatarEl = document.getElementById("profileAvatar");
  if (user.avatar_url) {
    avatarEl.src = user.avatar_url;
    avatarEl.style.display = "block";
  } else {
    avatarEl.src = "";
    avatarEl.style.display = "none";
  }

  // Afficher le bouton d'édition si c'est notre profil
  const avatarEditBtn = document.getElementById("avatarEditBtn");
  if (currentWallet && currentWallet === profileWallet) {
    avatarEditBtn.classList.remove("hidden");
  } else {
    avatarEditBtn.classList.add("hidden");
  }

  const { data: statements } = await supabase
    .from("statements")
    .select("content, created_at")
    .eq("user_wallet", user.wallet)
    .order("created_at", { ascending: false });

  await updateFollowCounts();

  const followBtn = document.getElementById("followBtn");

  if (currentWallet && currentWallet === profileWallet) {
    followBtn.style.display = "none";
  } else if (currentWallet && profileWallet) {
    followBtn.style.display = "block";
    
    try {
      console.log("Checking follow status:", currentWallet, "->", profileWallet);
      const { data: existingFollow, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_wallet", currentWallet)
        .eq("following_wallet", profileWallet)
        .maybeSingle();

      if (error) {
        console.error("Error checking follow status:", error);
      }

      console.log("Existing follow data:", existingFollow);

      if (existingFollow && existingFollow.id) {
        console.log("User is following, setting button to unfollow");
        followBtn.innerText = "unfollow";
        followBtn.classList.add("following");
        followBtn.classList.remove("disabled");
      } else {
        console.log("User is not following, setting button to follow");
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
        console.log("Unfollowing:", currentWallet, "->", profileWallet);
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
        
        console.log("Unfollow successful, data:", data);
        
        // Mettre à jour le bouton immédiatement
        followBtn.innerText = "follow";
        followBtn.classList.remove("following");
      } else {
        // Follow
        console.log("Following:", currentWallet, "->", profileWallet);
        
        const { data: insertData, error } = await supabase
          .from("follows")
          .insert({
            follower_wallet: currentWallet,
            following_wallet: profileWallet
          })
          .select();
        
        if (error) {
          console.error("Error following:", error);
          if (error.code === "23505") {
            // Duplicate key error - already following, juste mettre à jour le bouton
            console.log("Already following, updating button...");
            followBtn.innerText = "unfollow";
            followBtn.classList.add("following");
          } else {
            alert(`Failed to follow: ${error.message}`);
            followBtn.disabled = false;
            followBtn.style.pointerEvents = "auto";
            return;
          }
        } else {
          console.log("Follow successful, data:", insertData);
          
          // Mettre à jour le bouton immédiatement
          followBtn.innerText = "unfollow";
          followBtn.classList.add("following");
        }
      }

      // Réactiver le bouton
      followBtn.disabled = false;
      followBtn.style.pointerEvents = "auto";
      
      // Mettre à jour seulement les compteurs sans toucher au bouton
      await updateFollowCounts();
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

  // ---------- FOLLOWERS/FOLLOWING MODALS ----------
  const followersModal = document.getElementById("followersModal");
  const followingModal = document.getElementById("followingModal");
  const followersList = document.getElementById("followersList");
  const followingList = document.getElementById("followingList");

  document.getElementById("followersStat").onclick = () => {
    if (profileWallet) {
      loadFollowers();
      followersModal.classList.remove("hidden");
    }
  };

  document.getElementById("followingStat").onclick = () => {
    if (profileWallet) {
      loadFollowing();
      followingModal.classList.remove("hidden");
    }
  };

  document.getElementById("closeFollowersBtn").onclick = () => {
    followersModal.classList.add("hidden");
  };

  document.getElementById("closeFollowingBtn").onclick = () => {
    followingModal.classList.add("hidden");
  };

  // ---------- AVATAR UPLOAD ----------
  const avatarModal = document.getElementById("avatarModal");
  const avatarEditBtn = document.getElementById("avatarEditBtn");
  const avatarFileInput = document.getElementById("avatarFileInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const saveAvatarBtn = document.getElementById("saveAvatarBtn");
  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  const closeAvatarBtn = document.getElementById("closeAvatarBtn");

  let selectedAvatarFile = null;

  avatarEditBtn.onclick = () => {
    avatarModal.classList.remove("hidden");
    const currentAvatar = document.getElementById("profileAvatar").src;
    avatarPreview.src = currentAvatar || "";
  };

  closeAvatarBtn.onclick = () => {
    avatarModal.classList.add("hidden");
    selectedAvatarFile = null;
    avatarFileInput.value = "";
  };

  avatarFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        avatarPreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  saveAvatarBtn.onclick = async () => {
    if (!currentWallet || currentWallet !== profileWallet) return;

    try {
      let avatarUrl = null;

      if (selectedAvatarFile) {
        // Upload vers Supabase Storage
        const fileExt = selectedAvatarFile.name.split('.').pop();
        const fileName = `${currentWallet}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Convertir l'image en blob et redimensionner si nécessaire
        const resizedFile = await resizeImage(selectedAvatarFile, 400, 400);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, resizedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          alert("Failed to upload avatar");
          return;
        }

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      // Mettre à jour dans la base de données
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("wallet", currentWallet);

      if (updateError) {
        console.error("Update error:", updateError);
        alert("Failed to update avatar");
        return;
      }

      // Mettre à jour l'affichage
      const avatarEl = document.getElementById("profileAvatar");
      if (avatarUrl) {
        avatarEl.src = avatarUrl;
        avatarEl.style.display = "block";
      } else {
        avatarEl.src = "";
        avatarEl.style.display = "none";
      }

      avatarModal.classList.add("hidden");
      selectedAvatarFile = null;
      avatarFileInput.value = "";
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred");
    }
  };

  removeAvatarBtn.onclick = async () => {
    if (!currentWallet || currentWallet !== profileWallet) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ avatar_url: null })
        .eq("wallet", currentWallet);

      if (error) {
        console.error("Error removing avatar:", error);
        alert("Failed to remove avatar");
        return;
      }

      const avatarEl = document.getElementById("profileAvatar");
      avatarEl.src = "";
      avatarEl.style.display = "none";
      avatarPreview.src = "";

      avatarModal.classList.add("hidden");
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred");
    }
  };

  // Fonction pour redimensionner l'image
  function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.9);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadFollowers() {
    if (!profileWallet) return;

    const { data: follows } = await supabase
      .from("follows")
      .select("follower_wallet")
      .eq("following_wallet", profileWallet);

    if (!follows || follows.length === 0) {
      followersList.innerHTML = '<div class="empty-state">no followers yet</div>';
      return;
    }

    const wallets = follows.map(f => f.follower_wallet);
    
    if (wallets.length === 0) {
      followersList.innerHTML = '<div class="empty-state">no followers yet</div>';
      return;
    }

    const { data: users } = await supabase
      .from("users")
      .select("wallet, username")
      .in("wallet", wallets);

    followersList.innerHTML = "";

    if (!users || users.length === 0) {
      followersList.innerHTML = '<div class="empty-state">no followers yet</div>';
      return;
    }

    users.forEach(user => {
      const userEl = document.createElement("div");
      userEl.className = "user-item";
      userEl.innerHTML = `
        <a href="profile.html?u=${encodeURIComponent(user.username)}" class="user-link">${user.username}</a>
      `;
      followersList.appendChild(userEl);
    });
  }

  async function loadFollowing() {
    if (!profileWallet) return;

    const { data: follows } = await supabase
      .from("follows")
      .select("following_wallet")
      .eq("follower_wallet", profileWallet);

    if (!follows || follows.length === 0) {
      followingList.innerHTML = '<div class="empty-state">not following anyone yet</div>';
      return;
    }

    const wallets = follows.map(f => f.following_wallet);
    
    if (wallets.length === 0) {
      followingList.innerHTML = '<div class="empty-state">not following anyone yet</div>';
      return;
    }

    const { data: users } = await supabase
      .from("users")
      .select("wallet, username")
      .in("wallet", wallets);

    followingList.innerHTML = "";

    if (!users || users.length === 0) {
      followingList.innerHTML = '<div class="empty-state">not following anyone yet</div>';
      return;
    }

    users.forEach(user => {
      const userEl = document.createElement("div");
      userEl.className = "user-item";
      userEl.innerHTML = `
        <a href="profile.html?u=${encodeURIComponent(user.username)}" class="user-link">${user.username}</a>
      `;
      followingList.appendChild(userEl);
    });
  }

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
