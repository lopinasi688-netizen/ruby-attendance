
import { supabase } from "./supabase.js";

// ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
export async function requireTeacher() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        window.location.href = "login.html";
        return null;
    }

    // ตรวจสอบสิทธิ์ครูจากฐานข้อมูล
    const { data: profile, error: profileError } = await supabase
        .from("teacher_profiles")
        .select("id, full_name, role")
        .eq("id", data.session.user.id)
        .eq("role", "teacher")
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "login.html";
        return null;
    }

    return {
        user: data.session.user,
        profile
    };
}

// ออกจากระบบ
export async function logoutTeacher() {
    await supabase.auth.signOut();
    window.location.href = "login.html";
}
