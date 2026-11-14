
/* =================================
   ระบบเช็คชื่อนักเรียน
   SUPABASE ATTENDANCE SYSTEM
================================= */

import { supabase } from "./supabase.js";
import { requireTeacher } from "./auth.js";

// =================================
// STATE
// =================================

let students = [];
let classrooms = [];
let selectedClassroom = null;

let records = {};
let currentDate = "";
let currentStatuses = {};
let drafts = {};
let currentUserId = null;

let isSaving = false;
let isLoadingDate = false;

const tableBody = document.getElementById("attendanceTableBody");
const dateInput = document.getElementById("attendanceDate");
const searchInput = document.getElementById("attendanceSearch");
const saveButton = document.getElementById("saveAttendanceBtn");
const classroomSelect = document.getElementById("attendanceClassroom");
const semesterSelect = document.getElementById("attendanceSemester");

const STATUS = {
    present: "มาเรียน",
    absent: "ขาดเรียน",
    late: "มาสาย",
    leave: "ลา"
};

const STUDENT_STATUS = {
    studying: "กำลังศึกษา",
    suspended: "พักการเรียน",
    transferred: "ย้ายออก",
    graduated: "พ้นสภาพ"
};

// =================================
// ATTENDANCE NOTICE
// =================================

function showAttendanceNotice() {
    const style = document.createElement("style");

    style.textContent = `
        .attendance-notice-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 0, 0, 0.72);
            backdrop-filter: blur(5px);
        }

        .attendance-notice-box {
            width: 100%;
            max-width: 440px;
            padding: 28px;
            border-radius: 18px;
            background: #181824;
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            animation: attendanceNoticeIn 0.25s ease;
        }

        .attendance-notice-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            font-size: 25px;
            margin-bottom: 18px;
        }

        .attendance-notice-box h2 {
            margin: 0 0 12px;
            font-size: 19px;
        }

        .attendance-notice-box p {
            margin: 0;
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.8;
        }

        .attendance-notice-box button {
            width: 100%;
            margin-top: 24px;
            padding: 12px;
            border: none;
            border-radius: 10px;
            background: #10b981;
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
        }

        .attendance-notice-box button:hover {
            background: #059669;
        }

        @keyframes attendanceNoticeIn {
            from {
                opacity: 0;
                transform: translateY(12px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
    `;

    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "attendance-notice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "attendanceNoticeTitle");

    const box = document.createElement("div");
    box.className = "attendance-notice-box";

    const icon = document.createElement("div");
    icon.className = "attendance-notice-icon";
    icon.textContent = "⚠";

    const title = document.createElement("h2");
    title.id = "attendanceNoticeTitle";
    title.textContent = "แจ้งเตือนการใช้งาน";

    const message = document.createElement("p");
    message.textContent =
        "ห้องเรียนที่ปิดใช้งานแล้วจะไม่สามารถบันทึกการเช็กชื่อใหม่ได้ แต่ข้อมูลและประวัติการเข้าเรียนเดิมยังคงอยู่ และสามารถเปิดดูย้อนหลังได้ตามปกติ";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "รับทราบ";

    button.addEventListener("click", () => {
        overlay.remove();
        style.remove();
    });

    box.append(icon, title, message, button);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    button.focus();
}

// =================================
// DATE
// =================================

function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function updateThaiDate(date) {
    const element = document.getElementById("thaiDate");
    const parsed = new Date(date + "T12:00:00");

    element.textContent = parsed.toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function getScopeKey() {
    if (!selectedClassroom || !currentDate) return "";

    return `${selectedClassroom.id}_${currentDate}`;
}

// =================================
// SAVE BUTTON STATE
// =================================

function updateSaveButton() {
    saveButton.disabled =
        isSaving ||
        isLoadingDate ||
        !selectedClassroom;

    saveButton.textContent = isSaving
        ? "กำลังบันทึก..."
        : "✓ บันทึกการเช็กชื่อ";
}

// =================================
// TOAST
// =================================

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// =================================
// CHECK CLASSROOM ACTIVE STATUS
// =================================

async function verifyClassroomActive() {
    if (!selectedClassroom) return false;

    const { data, error } = await supabase
        .from("classrooms")
        .select("is_active")
        .eq("id", selectedClassroom.id)
        .maybeSingle();

    if (error) {
        console.error("Verify classroom error:", error);
        throw error;
    }

    if (!data || data.is_active !== true) {
        showToast(
            "ห้องเรียนนี้ถูกปิดใช้งานแล้ว กรุณาโหลดหน้าใหม่"
        );

        return false;
    }

    return true;
}

// =================================
// LOAD CLASSROOMS
// =================================

async function loadClassrooms() {
    const { data, error } = await supabase
        .from("classrooms")
        .select("id, education_level, year_level, room_number, academic_year")
        .eq("is_active", true)
        .order("academic_year", { ascending: false })
        .order("year_level", { ascending: true })
        .order("room_number", { ascending: true });

    if (error) {
        console.error("Load classrooms error:", error);
        showToast("โหลดข้อมูลห้องเรียนไม่สำเร็จ");
        return false;
    }

    classrooms = data || [];

    classroomSelect.innerHTML = "";

    if (classrooms.length === 0) {
        classroomSelect.innerHTML =
            '<option value="">ยังไม่มีห้องเรียน</option>';

        selectedClassroom = null;
        students = [];
        currentStatuses = {};

        renderAttendance();
        updateSaveButton();

        showToast("กรุณาสร้างห้องเรียนก่อนเริ่มเช็กชื่อ");
        return true;
    }

    classrooms.forEach(classroom => {
        const option = document.createElement("option");

        option.value = classroom.id;
        option.textContent =
            `${classroom.education_level}${classroom.year_level}/${classroom.room_number}`;

        classroomSelect.appendChild(option);
    });

    selectedClassroom = classrooms[0];
    classroomSelect.value = selectedClassroom.id;

    return true;
}

// =================================
// LOAD STUDENTS BY CLASSROOM
// =================================

async function loadStudents() {
    if (!selectedClassroom) {
        students = [];
        renderAttendance();
        return true;
    }

    const { data, error } = await supabase
        .from("students")
        .select("id, student_code, full_name, is_active, student_status, classroom_id")
        .eq("classroom_id", selectedClassroom.id)
        .order("student_code", { ascending: true });

    if (error) {
        console.error("Load students error:", error);
        showToast("โหลดรายชื่อนักเรียนไม่สำเร็จ");
        return false;
    }

    students = (data || []).map(student => ({
        id: student.id,
        code: student.student_code,
        name: student.full_name,
        status: student.student_status || (
            student.is_active ? "studying" : "transferred"
        )
    }));

    return true;
}

// =================================
// LOAD ATTENDANCE BY DATE + ROOM
// =================================

async function loadDate(date) {
    if (!date || isSaving || !selectedClassroom) return false;

    isLoadingDate = true;
    updateSaveButton();

    document.getElementById("saveInformation").textContent =
        "กำลังโหลดข้อมูล...";

    try {
        const { data, error } = await supabase
            .from("attendance")
            .select("student_id, status")
            .eq("attendance_date", date)
            .eq("classroom_id", selectedClassroom.id);

        if (error) {
            console.error("Load attendance error:", error);
            showToast("โหลดข้อมูลการเช็กชื่อไม่สำเร็จ");

            dateInput.value = currentDate;
            return false;
        }

        const savedStatuses = {};

        (data || []).forEach(record => {
            savedStatuses[record.student_id] = record.status;
        });

        currentDate = date;

        updateThaiDate(date);

        const scopeKey = getScopeKey();

        records[scopeKey] = { ...savedStatuses };
        currentStatuses = { ...savedStatuses };

        // คืนค่ารายการที่แก้ไขไว้แต่ยังไม่ได้บันทึก
        const dateDrafts = drafts[scopeKey] || {};

        Object.entries(dateDrafts).forEach(([studentId, status]) => {
            if (status === null) {
                delete currentStatuses[studentId];
            } else {
                currentStatuses[studentId] = status;
            }
        });

        const savedCount = Object.keys(savedStatuses).length;

        document.getElementById("saveInformation").textContent =
            savedCount > 0
                ? `พบข้อมูลที่บันทึกไว้แล้ว ${savedCount} คน`
                : "ยังไม่ได้บันทึกการเช็กชื่อ";

        renderAttendance(searchInput.value);

        return true;

    } catch (error) {
        console.error("Load date error:", error);

        showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        dateInput.value = currentDate;

        return false;

    } finally {
        isLoadingDate = false;
        updateSaveButton();
        renderAttendance(searchInput.value);
    }
}

// =================================
// RENDER STUDENTS
// =================================

function renderAttendance(keyword = "") {
    tableBody.innerHTML = "";

    const search = keyword.trim().toLowerCase();

    const filtered = students.filter(student => {
        const code = String(student.code || "").toLowerCase();
        const name = String(student.name || "").toLowerCase();

        return code.includes(search) || name.includes(search);
    });

    const empty = document.getElementById("attendanceEmpty");

    empty.style.display =
        filtered.length === 0 ? "block" : "none";

    if (students.length === 0) {
        empty.querySelector("h3").textContent =
            "ยังไม่มีรายชื่อนักเรียนในห้องนี้";

        empty.querySelector("p").textContent =
            "เพิ่มนักเรียนและกำหนดห้องเรียนในหน้ารายชื่อนักเรียน";

    } else {
        empty.querySelector("h3").textContent =
            "ไม่พบข้อมูลนักเรียน";

        empty.querySelector("p").textContent =
            "ลองค้นหาด้วยชื่อหรือรหัสอื่น";
    }

    filtered.forEach(student => {
        const row = document.createElement("tr");

        const code = document.createElement("td");
        code.className = "student-code";
        code.textContent = student.code || "-";

        const name = document.createElement("td");
        name.className = "student-name";
        name.textContent = student.name || "-";

        const actionCell = document.createElement("td");

        if (student.status !== "studying") {
            const statusLabel = document.createElement("span");

            statusLabel.textContent =
                STUDENT_STATUS[student.status] || "ไม่สามารถเช็กชื่อได้";

            statusLabel.style.display = "inline-block";
            statusLabel.style.padding = "6px 12px";
            statusLabel.style.borderRadius = "8px";
            statusLabel.style.background = "rgba(148, 163, 184, 0.12)";
            statusLabel.style.color = "#94a3b8";
            statusLabel.style.fontSize = "13px";

            actionCell.appendChild(statusLabel);

        } else {
            const actions = document.createElement("div");
            actions.className = "attendance-actions";

            Object.entries(STATUS).forEach(([key, label]) => {
                const button = document.createElement("button");

                button.type = "button";
                button.className = "attendance-btn";
                button.textContent = label;

                if (currentStatuses[student.id] === key) {
                    button.classList.add("selected", key);
                }

                button.disabled = isSaving || isLoadingDate;

                button.addEventListener("click", () => {
                    if (isSaving || isLoadingDate) return;

                    const scopeKey = getScopeKey();

                    // กดสถานะเดิมซ้ำ = ยกเลิกสถานะ
                    if (currentStatuses[student.id] === key) {
                        delete currentStatuses[student.id];

                        drafts[scopeKey] ||= {};
                        drafts[scopeKey][student.id] = null;

                    } else {
                        currentStatuses[student.id] = key;

                        drafts[scopeKey] ||= {};
                        drafts[scopeKey][student.id] = key;
                    }

                    renderAttendance(searchInput.value);
                });

                actions.appendChild(button);
            });

            actionCell.appendChild(actions);
        }

        row.append(code, name, actionCell);
        tableBody.appendChild(row);
    });

    updateStatistics();
}

// =================================
// STATISTICS
// =================================

function updateStatistics() {
    const counts = {
        present: 0,
        absent: 0,
        late: 0,
        leave: 0
    };

    let checked = 0;
    let eligible = 0;

    students.forEach(student => {
        if (student.status !== "studying") return;

        eligible++;

        const status = currentStatuses[student.id];

        if (Object.hasOwn(counts, status)) {
            counts[status]++;
            checked++;
        }
    });

    document.getElementById("totalCount").textContent =
        students.length;

    document.getElementById("presentCount").textContent =
        counts.present;

    document.getElementById("absentCount").textContent =
        counts.absent;

    document.getElementById("lateCount").textContent =
        counts.late;

    document.getElementById("leaveCount").textContent =
        counts.leave;

    document.getElementById("pendingCount").textContent =
        `รอตรวจสอบ ${eligible - checked} คน`;
}

// =================================
// SAVE ATTENDANCE TO SUPABASE
// =================================

async function saveAttendance() {
    if (isSaving || isLoadingDate) return;

    if (!selectedClassroom) {
        showToast("กรุณาเลือกห้องเรียนก่อน");
        return;
    }

    if (!currentDate) {
        showToast("กรุณาเลือกวันที่ก่อน");
        return;
    }

    if (!semesterSelect.value) {
        showToast("กรุณาเลือกภาคเรียนก่อนบันทึก");
        return;
    }

    if (students.length === 0) {
        showToast("ห้องเรียนนี้ยังไม่มีรายชื่อนักเรียน");
        return;
    }

    if (!currentUserId) {
        showToast("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่");
        return;
    }

    const scopeKey = getScopeKey();
    const dateDrafts = drafts[scopeKey] || {};
    const savedStatuses = records[scopeKey] || {};

    // บันทึกได้เฉพาะนักเรียนที่กำลังศึกษา
    const eligibleStudents = students.filter(
        student => student.status === "studying"
    );

    const changedStudents = eligibleStudents.filter(student => {
        const newStatus = dateDrafts[student.id];

        return (
            newStatus !== undefined &&
            newStatus !== null &&
            Object.hasOwn(STATUS, newStatus) &&
            savedStatuses[student.id] !== newStatus
        );
    });

    const removedStudentIds = eligibleStudents
        .map(student => student.id)
        .filter(studentId => {
            return (
                dateDrafts[studentId] === null &&
                Object.hasOwn(savedStatuses, studentId)
            );
        });

    if (
        changedStudents.length === 0 &&
        removedStudentIds.length === 0
    ) {
        delete drafts[scopeKey];

        showToast("ไม่มีข้อมูลที่เปลี่ยนแปลง");
        return;
    }

    isSaving = true;
    updateSaveButton();
    renderAttendance(searchInput.value);

    try {
        // ตรวจสอบสถานะห้องจากฐานข้อมูลล่าสุดก่อนเขียนข้อมูล
        const classroomIsActive = await verifyClassroomActive();

        if (!classroomIsActive) return;

        // เพิ่มหรือแก้ไขสถานะการเข้าเรียน
        if (changedStudents.length > 0) {
            const checkedAt = new Date().toISOString();

            const payload = changedStudents.map(student => ({
                student_id: student.id,
                classroom_id: selectedClassroom.id,
                academic_year: selectedClassroom.academic_year,
                semester: Number(semesterSelect.value),
                attendance_date: currentDate,
                status: currentStatuses[student.id],
                checked_at: checkedAt,
                checked_by: currentUserId
            }));

            const { error } = await supabase
                .from("attendance")
                .upsert(payload, {
                    onConflict: "student_id,attendance_date"
                });

            if (error) throw error;
        }

        // ลบสถานะที่ครูกดยกเลิก
        if (removedStudentIds.length > 0) {
            const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("attendance_date", currentDate)
                .eq("classroom_id", selectedClassroom.id)
                .in("student_id", removedStudentIds);

            if (error) throw error;
        }

        const updatedRecords = { ...savedStatuses };

        changedStudents.forEach(student => {
            updatedRecords[student.id] = currentStatuses[student.id];
        });

        removedStudentIds.forEach(studentId => {
            delete updatedRecords[studentId];
        });

        records[scopeKey] = updatedRecords;

        delete drafts[scopeKey];

        const savedCount = Object.keys(updatedRecords).length;

        document.getElementById("saveInformation").textContent =
            `บันทึกแล้ว ${savedCount} จาก ${eligibleStudents.length} คน`;

        showToast("บันทึกการเช็กชื่อสำเร็จ");

    } catch (error) {
        console.error("Save attendance error:", error);

        showToast(
            "บันทึกไม่สำเร็จ: " + (error.message || "เกิดข้อผิดพลาด")
        );

    } finally {
        isSaving = false;
        updateSaveButton();
        renderAttendance(searchInput.value);
    }
}

// =================================
// EVENTS
// =================================

dateInput.addEventListener("change", async event => {
    const date = event.target.value;

    if (!date || !selectedClassroom) return;

    await loadDate(date);
});

classroomSelect.addEventListener("change", async event => {
    if (isSaving || isLoadingDate) return;

    const classroom = classrooms.find(
        item => item.id === event.target.value
    );

    if (!classroom) return;

    selectedClassroom = classroom;

    currentStatuses = {};
    students = [];

    const loaded = await loadStudents();

    if (!loaded) return;

    if (currentDate) {
        await loadDate(currentDate);
    } else {
        renderAttendance();
    }
});

searchInput.addEventListener("input", event => {
    renderAttendance(event.target.value);
});

saveButton.addEventListener("click", saveAttendance);

// =================================
// INITIALIZE
// =================================

async function initializeAttendance() {
    try {
        const auth = await requireTeacher();

        if (!auth) return;

        currentUserId = auth.user.id;

        // แจ้งเตือนทุกครั้งที่เข้าหน้านี้
        showAttendanceNotice();

        const classroomLoaded = await loadClassrooms();

        if (!classroomLoaded || !selectedClassroom) return;

        const studentsLoaded = await loadStudents();

        if (!studentsLoaded) return;

        dateInput.value = getLocalDate();

        const loadedDate = await loadDate(dateInput.value);

        if (!loadedDate) return;

        console.log(
            "Student Attendance System connected to Supabase."
        );

    } catch (error) {
        console.error("Attendance initialization error:", error);

        showToast("เกิดข้อผิดพลาดในการเริ่มต้นระบบ");
    }
}

initializeAttendance();
