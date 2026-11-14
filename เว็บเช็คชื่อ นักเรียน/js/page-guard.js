import { requireTeacher, logoutTeacher } from "./auth.js";

// ตรวจสอบสิทธิ์ครูก่อนอนุญาตให้ใช้งานหน้าเว็บ
document.addEventListener("DOMContentLoaded", async () => {
    document.body.style.visibility = "hidden";

    const result = await requireTeacher();

    if (!result) return;

    // ผูกปุ่มออกจากระบบ
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            logoutBtn.disabled = true;
            logoutBtn.textContent = "กำลังออกจากระบบ...";

            try {
                await logoutTeacher();
            } catch (error) {
                console.error("Logout error:", error);

                logoutBtn.disabled = false;
                logoutBtn.textContent = "ออกจากระบบ";

                alert("ไม่สามารถออกจากระบบได้ กรุณาลองอีกครั้ง");
            }
        });
    }

    document.body.style.visibility = "visible";
});
