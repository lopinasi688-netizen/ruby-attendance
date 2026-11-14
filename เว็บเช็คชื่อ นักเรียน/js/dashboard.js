import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const elements = {
    currentDate: $("currentDate"),
    totalStudents: $("totalStudents"),
    presentCount: $("presentCount"),
    absentCount: $("absentCount"),
    lateCount: $("lateCount"),
    leaveCount: $("summaryLeave"),
    summaryPresent: $("summaryPresent"),
    summaryAbsent: $("summaryAbsent"),
    summaryLate: $("summaryLate"),
    attendancePercent: $("attendancePercent"),
    attendanceCircle: $("attendanceCircle")
};

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function showCurrentDate() {
    if (!elements.currentDate) return;

    elements.currentDate.textContent = new Intl.DateTimeFormat("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date());
}

function setNumber(element, value) {
    if (element) {
        element.textContent = Number(value || 0).toLocaleString("th-TH");
    }
}

async function loadDashboard() {
    showCurrentDate();

    try {
        // จำนวนนักเรียนที่ยังศึกษาอยู่
        const { count: studentCount, error: studentError } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .eq("student_status", "studying");

        if (studentError) throw studentError;

        setNumber(elements.totalStudents, studentCount);

        // ดึงข้อมูลการเข้าเรียนของวันนี้
        const today = getLocalDate();

        const { data: attendance, error: attendanceError } = await supabase
            .from("attendance")
            .select("status")
            .eq("attendance_date", today);

        if (attendanceError) throw attendanceError;

        const records = attendance || [];

        const counts = {
            present: 0,
            absent: 0,
            late: 0,
            leave: 0
        };

        records.forEach((record) => {
            if (Object.prototype.hasOwnProperty.call(counts, record.status)) {
                counts[record.status]++;
            }
        });

        // แสดงตัวเลขบนการ์ด
        setNumber(elements.presentCount, counts.present);
        setNumber(elements.absentCount, counts.absent);
        setNumber(elements.lateCount, counts.late);

        // แสดงตัวเลขในสรุปวงกลม
        setNumber(elements.summaryPresent, counts.present);
        setNumber(elements.summaryAbsent, counts.absent);
        setNumber(elements.summaryLate, counts.late);
        setNumber(elements.leaveCount, counts.leave);

        // คำนวณเปอร์เซ็นต์จากรายการที่มีการบันทึกแล้ว
        const totalRecords = records.length;
        const attended = counts.present + counts.late;

        const percentage = totalRecords > 0
            ? Math.round((attended / totalRecords) * 100)
            : 0;

        if (elements.attendancePercent) {
            elements.attendancePercent.textContent = `${percentage}%`;
        }

        if (elements.attendanceCircle) {
            elements.attendanceCircle.style.setProperty(
                "--progress",
                `${percentage}%`
            );
        }

    } catch (error) {
        console.error("Dashboard loading error:", error);

        // แสดงข้อผิดพลาดไว้ใน Console เพื่อให้ตรวจสอบได้
        if (elements.totalStudents) {
            elements.totalStudents.textContent = "!";
        }
    }
}

loadDashboard();