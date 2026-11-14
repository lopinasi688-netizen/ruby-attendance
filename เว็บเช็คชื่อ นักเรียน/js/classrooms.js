
import { supabase } from "./supabase.js";
import { requireTeacher, logoutTeacher } from "./auth.js";

// =====================================
// ELEMENTS
// =====================================

const tableBody = document.getElementById("classroomTableBody");
const emptyState = document.getElementById("classroomEmptyState");

const totalClassrooms = document.getElementById("totalClassrooms");
const activeClassrooms = document.getElementById("activeClassrooms");

const searchInput = document.getElementById("classroomSearch");

const modal = document.getElementById("classroomModal");
const form = document.getElementById("classroomForm");

const modalTitle = document.getElementById("classroomModalTitle");
const classroomNameInput = document.getElementById("classroomName");
const academicYearInput = document.getElementById("academicYear");
const editClassroomId = document.getElementById("editClassroomId");

const addButton = document.getElementById("addClassroomBtn");
const closeButton = document.getElementById("closeClassroomModal");
const cancelButton = document.getElementById("cancelClassroomBtn");
const saveButton = document.getElementById("saveClassroomBtn");

const toast = document.getElementById("classroomToast");

let classrooms = [];
let toastTimer = null;

// =====================================
// UTILITIES
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showToast(message, type = "success") {
    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = `classroom-toast show ${type}`;

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// =====================================
// CLASSROOM NAME
// =====================================

function parseClassroomName(value) {
    const name = value.trim();

    const match = name.match(
        /^(อนุบาล|ป\.|ม\.)\s*(\d+)\s*\/\s*(\d+)$/
    );

    if (!match) {
        return null;
    }

    const yearLevel = Number(match[2]);
    const roomNumber = Number(match[3]);

    if (
        !Number.isInteger(yearLevel) ||
        !Number.isInteger(roomNumber) ||
        yearLevel < 1 ||
        roomNumber < 1
    ) {
        return null;
    }

    return {
        education_level: match[1],
        year_level: yearLevel,
        room_number: String(roomNumber)
    };
}

function getClassroomName(classroom) {
    const prefix = classroom.education_level === "อนุบาล"
        ? "อนุบาล "
        : classroom.education_level;

    return `${prefix}${classroom.year_level}/${classroom.room_number}`;
}

// =====================================
// LOAD DATA
// =====================================

async function loadClassrooms() {
    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="classroom-loading">
                กำลังโหลดข้อมูล...
            </td>
        </tr>
    `;

    emptyState.hidden = true;

    const { data, error } = await supabase
        .from("classrooms")
        .select(`
            id,
            education_level,
            year_level,
            room_number,
            academic_year,
            is_active,
            created_at
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load classrooms error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="classroom-loading">
                    โหลดข้อมูลไม่สำเร็จ:
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showToast("ไม่สามารถโหลดห้องเรียนได้", "error");
        return;
    }

    classrooms = data || [];

    updateStats();
    renderClassrooms();
}

// =====================================
// STATISTICS
// =====================================

function updateStats() {
    totalClassrooms.textContent = classrooms.length;

    activeClassrooms.textContent = classrooms.filter(
        classroom => classroom.is_active === true
    ).length;
}

// =====================================
// RENDER TABLE
// =====================================

function renderClassrooms() {
    const keyword = searchInput.value.trim().toLowerCase();

    const filtered = classrooms.filter(classroom => {
        const name = getClassroomName(classroom).toLowerCase();

        return (
            name.includes(keyword) ||
            String(classroom.academic_year).includes(keyword)
        );
    });

    tableBody.innerHTML = "";

    if (filtered.length === 0) {
        emptyState.hidden = false;

        if (classrooms.length > 0) {
            emptyState.querySelector("h3").textContent =
                "ไม่พบห้องเรียน";

            emptyState.querySelector("p").textContent =
                "ลองค้นหาด้วยชื่อห้องหรือปีการศึกษาอื่น";
        } else {
            emptyState.querySelector("h3").textContent =
                "ยังไม่มีห้องเรียน";

            emptyState.querySelector("p").textContent =
                "เริ่มต้นด้วยการเพิ่มห้องเรียนแรกของคุณ";
        }

        return;
    }

    emptyState.hidden = true;

    filtered.forEach(classroom => {
        const row = document.createElement("tr");

        const statusClass = classroom.is_active
            ? "active"
            : "inactive";

        const statusText = classroom.is_active
            ? "เปิดใช้งาน"
            : "ปิดใช้งาน";

        row.innerHTML = `
            <td>
                <strong class="classroom-name">
                    ${escapeHTML(getClassroomName(classroom))}
                </strong>
            </td>

            <td>
                ${escapeHTML(classroom.academic_year)}
            </td>

            <td>
                <span class="classroom-status ${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td>
                <div class="classroom-actions">

                    <button
                        class="classroom-action edit"
                        data-action="edit"
                        data-id="${escapeHTML(classroom.id)}"
                    >
                        แก้ไข
                    </button>

                    <button
                        class="classroom-action toggle"
                        data-action="toggle"
                        data-id="${escapeHTML(classroom.id)}"
                    >
                        ${classroom.is_active
                            ? "ปิดใช้งาน"
                            : "เปิดใช้งาน"}
                    </button>

                    <button
                        class="classroom-action delete"
                        data-action="delete"
                        data-id="${escapeHTML(classroom.id)}"
                    >
                        ลบห้อง
                    </button>

                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// =====================================
// MODAL
// =====================================

function openModal(classroom = null) {
    form.reset();

    editClassroomId.value = classroom?.id || "";

    if (classroom) {
        modalTitle.textContent = "แก้ไขห้องเรียน";

        classroomNameInput.value = getClassroomName(classroom);
        academicYearInput.value = classroom.academic_year;

        saveButton.textContent = "บันทึกการแก้ไข";
    } else {
        modalTitle.textContent = "เพิ่มห้องเรียน";

        classroomNameInput.value = "";
        academicYearInput.value = new Date().getFullYear() + 543;

        saveButton.textContent = "บันทึกห้องเรียน";
    }

    modal.classList.add("show");
    classroomNameInput.focus();
}

function closeModal() {
    modal.classList.remove("show");

    form.reset();
    editClassroomId.value = "";

    saveButton.disabled = false;
    saveButton.textContent = "บันทึกห้องเรียน";
}

addButton.addEventListener("click", () => openModal());

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("show")) {
        closeModal();
    }
});

// =====================================
// SAVE CLASSROOM
// =====================================

form.addEventListener("submit", async event => {
    event.preventDefault();

    const parsed = parseClassroomName(classroomNameInput.value);
    const academicYear = Number(academicYearInput.value);
    const editingId = editClassroomId.value;

    if (!parsed) {
        showToast(
            "กรุณากรอกชื่อห้อง เช่น ป.1/1 หรือ อนุบาล 2/1",
            "error"
        );

        classroomNameInput.focus();
        return;
    }

    if (
        !Number.isInteger(academicYear) ||
        academicYear < 2500 ||
        academicYear > 2700
    ) {
        showToast("กรุณากรอกปีการศึกษาให้ถูกต้อง", "error");
        academicYearInput.focus();
        return;
    }

    const duplicate = classrooms.some(classroom => {
        return (
            classroom.id !== editingId &&
            classroom.education_level === parsed.education_level &&
            Number(classroom.year_level) === parsed.year_level &&
            String(classroom.room_number) === parsed.room_number &&
            Number(classroom.academic_year) === academicYear
        );
    });

    if (duplicate) {
        showToast(
            "ห้องเรียนนี้มีอยู่แล้วในปีการศึกษานี้",
            "error"
        );
        return;
    }

    const payload = {
        ...parsed,
        academic_year: academicYear
    };

    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";

    let result;

    try {
        if (editingId) {
            result = await supabase
                .from("classrooms")
                .update(payload)
                .eq("id", editingId);
        } else {
            result = await supabase
                .from("classrooms")
                .insert({
                    ...payload,
                    is_active: true
                });
        }
    } catch (error) {
        console.error("Save classroom exception:", error);
        showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
        saveButton.disabled = false;
        saveButton.textContent = editingId
            ? "บันทึกการแก้ไข"
            : "บันทึกห้องเรียน";
        return;
    }

    saveButton.disabled = false;
    saveButton.textContent = editingId
        ? "บันทึกการแก้ไข"
        : "บันทึกห้องเรียน";

    if (result.error) {
        console.error("Save classroom error:", result.error);

        if (result.error.code === "23505") {
            showToast(
                "ห้องเรียนนี้มีอยู่แล้วในปีการศึกษานี้",
                "error"
            );
        } else {
            showToast(
                "บันทึกไม่สำเร็จ: " + result.error.message,
                "error"
            );
        }

        return;
    }

    closeModal();

    showToast(
        editingId
            ? "แก้ไขห้องเรียนเรียบร้อย"
            : "เพิ่มห้องเรียนเรียบร้อย"
    );

    await loadClassrooms();
});

// =====================================
// DELETE CLASSROOM
// =====================================

async function deleteClassroom(classroom, button) {
    const classroomName = getClassroomName(classroom);

    const confirmed = confirm(
        `ต้องการลบห้อง ${classroomName} ปีการศึกษา ${classroom.academic_year} ใช่หรือไม่?\n\n` +
        "ระบบจะตรวจสอบข้อมูลก่อนลบ\n" +
        "หากพบข้อมูลนักเรียนหรือประวัติที่เชื่อมโยง จะไม่อนุญาตให้ลบ"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "กำลังตรวจสอบ...";

    try {
        // ตรวจสอบนักเรียนที่อยู่ในห้องนี้
        const { data: students, error: studentError } = await supabase
            .from("students")
            .select("id")
            .eq("classroom_id", classroom.id)
            .limit(1);

        if (studentError) {
            throw studentError;
        }

        if (students && students.length > 0) {
            showToast(
                "ลบไม่ได้: ห้องนี้ยังมีข้อมูลนักเรียนอยู่",
                "error"
            );
            return;
        }

        // ตรวจสอบประวัติการเข้าเรียน
        const { data: attendance, error: attendanceError } = await supabase
            .from("attendance")
            .select("id")
            .eq("classroom_id", classroom.id)
            .limit(1);

        if (attendanceError) {
            throw attendanceError;
        }

        if (attendance && attendance.length > 0) {
            showToast(
                "ลบไม่ได้: ห้องนี้มีประวัติการเข้าเรียนอยู่",
                "error"
            );
            return;
        }

        // ลบห้องเรียนเมื่อไม่พบข้อมูลที่เชื่อมโยง
        button.textContent = "กำลังลบ...";

        const { error: deleteError } = await supabase
            .from("classrooms")
            .delete()
            .eq("id", classroom.id);

        if (deleteError) {
            console.error("Delete classroom error:", deleteError);

            if (deleteError.code === "23503") {
                showToast(
                    "ลบไม่ได้: ห้องนี้มีประวัติหรือข้อมูลอื่นเชื่อมโยงอยู่",
                    "error"
                );
            } else {
                showToast(
                    "ลบห้องเรียนไม่สำเร็จ: " + deleteError.message,
                    "error"
                );
            }

            return;
        }

        showToast("ลบห้องเรียนเรียบร้อยแล้ว");
        await loadClassrooms();

    } catch (error) {
        console.error("Delete classroom check error:", error);

        showToast(
            "ตรวจสอบข้อมูลก่อนลบไม่สำเร็จ จึงยกเลิกการลบเพื่อความปลอดภัย",
            "error"
        );

    } finally {
        button.disabled = false;
        button.textContent = "ลบห้อง";
    }
}

// =====================================
// EDIT / TOGGLE / DELETE
// =====================================

tableBody.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    const classroom = classrooms.find(item => item.id === id);

    if (!classroom) return;

    if (action === "edit") {
        openModal(classroom);
        return;
    }

    if (action === "toggle") {
        const nextStatus = !classroom.is_active;

        button.disabled = true;

        const { error } = await supabase
            .from("classrooms")
            .update({
                is_active: nextStatus
            })
            .eq("id", id);

        if (error) {
            console.error("Toggle classroom error:", error);

            showToast(
                "เปลี่ยนสถานะไม่สำเร็จ: " + error.message,
                "error"
            );

            button.disabled = false;
            return;
        }

        showToast(
            nextStatus
                ? "เปิดใช้งานห้องเรียนแล้ว"
                : "ปิดใช้งานห้องเรียนแล้ว"
        );

        await loadClassrooms();
        return;
    }

    if (action === "delete") {
        await deleteClassroom(classroom, button);
    }
});

// =====================================
// SEARCH
// =====================================

searchInput.addEventListener("input", renderClassrooms);

// =====================================
// LOGOUT
// =====================================

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logoutTeacher();
});

// =====================================
// INITIALIZE
// =====================================

async function initialize() {
    const auth = await requireTeacher();

    if (!auth) return;

    await loadClassrooms();
}

initialize();
