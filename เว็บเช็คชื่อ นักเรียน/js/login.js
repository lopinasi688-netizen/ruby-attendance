
import { supabase } from "./supabase.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const button = document.getElementById("loginButton");

// ตรวจสอบว่าล็อกอินอยู่แล้วหรือไม่
const { data } = await supabase.auth.getSession();

if (data.session) {
    window.location.href = "index.html";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    button.disabled = true;
    button.textContent = "กำลังเข้าสู่ระบบ...";
    message.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        message.textContent = "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน";
        button.disabled = false;
        button.textContent = "เข้าสู่ระบบ";
        return;
    }

    window.location.href = "index.html";
});
