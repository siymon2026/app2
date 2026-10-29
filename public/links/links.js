document.addEventListener("DOMContentLoaded", () => {
  let serverData = {};

  // 1. نظام الضغطات المحكم (على الـ Div)
  let tapCount = 0;
  let tapTimer;
  const triggerBtn = document.getElementById("adminSecretBtn");
  const overlay = document.getElementById("adminOverlay");

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      tapCount++;
      clearTimeout(tapTimer);

      if (tapCount >= 3) {
        tapCount = 0;
        overlay.style.display = "flex"; // إظهار اللوحة
      } else {
        // مهلة ثانية واحدة للضغط 3 مرات
        tapTimer = setTimeout(() => {
          tapCount = 0;
        }, 1000);
      }
    });
  }

  // 2. دوال الإغلاق
  function closeAdmin() {
    overlay.style.display = "none";
    document.getElementById("adminLogin").style.display = "block";
    document.getElementById("adminDashboard").style.display = "none";
    document.getElementById("adminPass").value = "";
  }

  document
    .getElementById("closeLoginBtn")
    ?.addEventListener("click", closeAdmin);
  document
    .getElementById("closeDashBtn")
    ?.addEventListener("click", closeAdmin);

  // 3. جلب وعرض البيانات
  async function loadData() {
    try {
      const res = await fetch("/api/social");
      if (res.ok) {
        serverData = await res.json();

        // تعبئة البيانات في الصفحة للزوار
        if (serverData.name)
          document.getElementById("titleEl").textContent = serverData.name;
        if (serverData.desc)
          document.getElementById("subtitleEl").textContent = serverData.desc;

        const links = [
          "instagram",
          "facebook",
          "tiktok",
          "youtube",
          "playstore",
          "appstore",
          "website",
        ];
        links.forEach((id) => {
          const el = document.getElementById(`link-${id}`);
          if (el) {
            if (serverData[id]) {
              el.href = serverData[id];
              el.style.display = "flex";
            } else if (serverData[id] === "") {
              el.style.display = "none";
            }
          }
        });

        if (serverData.profileImg) {
          const img = document.getElementById("profileImg");
          img.src = serverData.profileImg;
          img.style.display = "block";
          document.getElementById("profilePlaceholder").style.display = "none";
        }
      }
    } catch (e) {
      console.error("خطأ في جلب البيانات:", e);
    }
  }

  // 4. دالة تسجيل الدخول
  document.getElementById("loginBtn")?.addEventListener("click", () => {
    const pass = document.getElementById("adminPass").value;
    if (!pass) return alert("أدخل الرقم السري");

    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";

    // تعبئة الفورم
    document.getElementById("adminName").value = serverData.name || "";
    document.getElementById("adminDesc").value = serverData.desc || "";
    document.getElementById("adminInsta").value = serverData.instagram || "";
    document.getElementById("adminFb").value = serverData.facebook || "";
    document.getElementById("adminTiktok").value = serverData.tiktok || "";
    document.getElementById("adminYt").value = serverData.youtube || "";
    document.getElementById("adminPlay").value = serverData.playstore || "";
    document.getElementById("adminApple").value = serverData.appstore || "";
    document.getElementById("adminWeb").value = serverData.website || "";
  });

  // 5. حفظ البيانات للسيرفر
  document.getElementById("saveBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("saveBtn");
    btn.textContent = "جاري الحفظ...";
    btn.disabled = true;

    const payload = {
      adminPass: document.getElementById("adminPass").value,
      name: document.getElementById("adminName").value,
      desc: document.getElementById("adminDesc").value,
      instagram: document.getElementById("adminInsta").value,
      facebook: document.getElementById("adminFb").value,
      tiktok: document.getElementById("adminTiktok").value,
      youtube: document.getElementById("adminYt").value,
      playstore: document.getElementById("adminPlay").value,
      appstore: document.getElementById("adminApple").value,
      website: document.getElementById("adminWeb").value,
      profileImg: serverData.profileImg,
    };

    const newPass = document.getElementById("adminNewPass").value;
    if (newPass) payload.newPassword = newPass;

    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("تم الحفظ بنجاح!");
        loadData(); // تحديث الصفحة
        closeAdmin(); // قفل اللوحة
      } else {
        const result = await res.json();
        alert(result.error || "الرقم السري غير صحيح أو فشل الحفظ");
      }
    } catch (e) {
      alert("حدث خطأ في الاتصال بالسيرفر");
    } finally {
      btn.textContent = "حفظ التغييرات";
      btn.disabled = false;
    }
  });

  // 6. رفع وضغط الصورة
  document
    .getElementById("profileUpload")
    ?.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          serverData.profileImg = canvas.toDataURL("image/jpeg", 0.7);
          document.getElementById("profileImg").src = serverData.profileImg;
          document.getElementById("profileImg").style.display = "block";
          document.getElementById("profilePlaceholder").style.display = "none";
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

  // تشغيل جلب البيانات فور تحميل الصفحة
  loadData();
});
