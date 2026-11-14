
import { supabase } from "./supabase.js";
import { requireTeacher } from "./auth.js";

let students = [];
let classrooms = [];
let isSaving = false;

const $ = id => document.getElementById(id);

const tableBody = $("studentTableBody");
const emptyState = $("emptyState");
const modal = $("studentModal");
const form = $("studentForm");
const searchInput = $("studentSearch");

const totalElement = $("totalStudents");
const activeElement = $("activeStudents");

const classroomSelect = $("studentClassroom");
const statusSelect = $("studentStatus");

const STATUS_LABELS = {
    studying: "กำลังศึกษา",
    suspended: "พักการเรียน",
    transferred: "ย้ายออก",
    graduated: "พ้นสภาพ"
};

function validateElements() {
    const elements = [
        tableBody,
        emptyState,
        modal,
        form,
        searchInput,
        totalElement,
        activeElement,
        classroomSelect,
        statusSelect,
        $("studentCode"),
        $("studentName"),
        $("editStudentId"),
        $("saveStudentBtn")
    ];

    if (elements.some(element => !element)) {
        throw new Error("ไม่พบ HTML element ที่จำเป็น");
    }
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function getClassroomName(classroom) {
    return `${classroom.education_level}${classroom.year_level}/${classroom.room_number}`;
}

function getClassroomLabel(classroom) {
    return `${getClassroomName(classroom)} · ปีการศึกษา ${classroom.academic_year}`;
}

function getClassroomById(id) {
    return classrooms.find(room => room.id === id);
}

function getStudentStatus(student) {
    if (student.student_status) {
        return student.student_status;
    }

    return student.is_active ? "studying" : "transferred";
}

async function loadClassrooms() {
    const { data, error } = await supabase
        .from("classrooms")
        .select(`
            id,
            education_level,
            year_level,
            room_number,
            academic_year,
            is_active
        `)
        .eq("is_active", true)
        .order("academic_year", { ascending: false })
        .order("year_level")
        .order("room_number");

    if (error) throw error;

    classrooms = data || [];

    renderClassroomOptions();
}

function renderClassroomOptions(selectedId = "") {
    classroomSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = classrooms.length
        ? "เลือกห้องเรียน"
        : "ยังไม่มีห้องเรียน กรุณาสร้างห้องเรียนก่อน";

    classroomSelect.appendChild(placeholder);

    classrooms.forEach(room => {
        const option = document.createElement("option");

        option.value = room.id;
        option.textContent = getClassroomLabel(room);

        classroomSelect.appendChild(option);
    });

    classroomSelect.value = selectedId || "";
}

async function loadStudents() {
    const { data, error } = await supabase
        .from("students")
        .select(`
            id,
            student_code,
            full_name,
            is_active,
            classroom_id,
            student_status
        `)
        .order("student_code");

    if (error) throw error;

    students = (data || []).map(student => ({
        ...student,
        student_status: getStudentStatus(student)
    }));

    renderStudents(searchInput.value);
}

function createStatusBadge(statusValue) {
    const badge = document.createElement("span");

    badge.className = `student-status status-${statusValue}`;
    badge.textContent = STATUS_LABELS[statusValue] || "ไม่ทราบสถานะ";

    return badge;
}

function renderStudents(keyword = "") {
    tableBody.innerHTML = "";

    const search = keyword.trim().toLowerCase();

    const filtered = students.filter(student => {
        const room = getClassroomById(student.classroom_id);
        const roomName = room ? getClassroomName(room) : "";

        return (
            String(student.student_code).toLowerCase().includes(search) ||
            String(student.full_name).toLowerCase().includes(search) ||
            roomName.toLowerCase().includes(search)
        );
    });

    emptyState.style.display =
        filtered.length === 0 ? "block" : "none";

    if (students.length > 0 && filtered.length === 0) {
        emptyState.querySelector("h3").textContent =
            "ไม่พบข้อมูลนักเรียน";

        emptyState.querySelector("p").textContent =
            "ลองค้นหาด้วยชื่อ รหัส หรือห้องเรียนอื่น";
    } else {
        emptyState.querySelector("h3").textContent =
            "ยังไม่มีข้อมูลนักเรียน";

        emptyState.querySelector("p").textContent =
            "กดปุ่มเพิ่มนักเรียนเพื่อเริ่มต้นใช้งาน";
    }

    filtered.forEach(student => {
        const row = document.createElement("tr");

        const codeCell = document.createElement("td");
        codeCell.className = "student-code";
        codeCell.textContent = student.student_code;

        const nameCell = document.createElement("td");
        nameCell.className = "student-name";
        nameCell.textContent = student.full_name;

        const roomCell = document.createElement("td");
        const room = getClassroomById(student.classroom_id);

        roomCell.textContent = room
            ? getClassroomName(room)
            : "ยังไม่กำหนดห้อง";

        const statusCell = document.createElement("td");
        statusCell.appendChild(
            createStatusBadge(student.student_status)
        );

        const actionCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "action-buttons";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "action-btn edit-btn";
        editButton.textContent = "แก้ไข";

        editButton.addEventListener("click", () => {
            editStudent(student.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "action-btn delete-btn";
        deleteButton.textContent = "ลบ";

        deleteButton.addEventListener("click", () => {
            handleDeleteStudent(student);
        });

        actions.append(editButton, deleteButton);
        actionCell.appendChild(actions);

        row.append(
            codeCell,
            nameCell,
            roomCell,
            statusCell,
            actionCell
        );

        tableBody.appendChild(row);
    });

    totalElement.textContent = students.length;

    activeElement.textContent = students.filter(
        student => student.student_status === "studying"
    ).length;
}

function openModal(student = null) {
    form.reset();

    $("editStudentId").value = "";

    $("modalTitle").textContent = student
        ? "แก้ไขข้อมูลนักเรียน"
        : "เพิ่มนักเรียน";

    renderClassroomOptions(student?.classroom_id || "");

    if (student) {
        $("editStudentId").value = student.id;
        $("studentCode").value = student.student_code;
        $("studentName").value = student.full_name;
        statusSelect.value = student.student_status;
    } else {
        statusSelect.value = "studying";
    }

    modal.classList.add("show");
}

function closeModal() {
    modal.classList.remove("show");
    form.reset();
}

function editStudent(id) {
    const student = students.find(item => item.id === id);

    if (!student) return;

    openModal(student);
}

async function hasDuplicateCode(code, classroomId, studentId = "") {
    let query = supabase
        .from("students")
        .select("id")
        .eq("student_code", code)
        .eq("classroom_id", classroomId);

    if (studentId) {
        query = query.neq("id", studentId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    return Boolean(data);
}

function handleSaveError(error) {
    if (
        error.code === "23505" ||
        String(error.message || "").includes(
            "students_classroom_student_code_key"
        )
    ) {
        showToast("รหัสนักเรียนนี้มีอยู่แล้วในห้องที่เลือก");
        return;
    }

    if (error.code === "23503") {
        showToast("ห้องเรียนที่เลือกไม่มีอยู่หรือถูกลบแล้ว");
        return;
    }

    showToast(error.message || "บันทึกไม่สำเร็จ");
}

async function createStudent(payload) {
    const { data, error } = await supabase
        .from("students")
        .insert({
            student_code: payload.student_code,
            full_name: payload.full_name,
            classroom_id: payload.classroom_id,
            student_status: payload.student_status,
            is_active: payload.student_status === "studying"
        })
        .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
        throw new Error("ไม่พบข้อมูลที่ถูกบันทึก");
    }
}

async function updateStudent(id, payload) {
    const { error } = await supabase.rpc(
        "update_student_with_history",
        {
            p_student_id: id,
            p_student_code: payload.student_code,
            p_full_name: payload.full_name,
            p_classroom_id: payload.classroom_id,
            p_student_status: payload.student_status
        }
    );

    if (error) throw error;
}

// ตรวจสอบประวัติก่อนลบ
async function deleteStudent(id) {
    const { data: attendanceRecords, error: attendanceError } =
        await supabase
            .from("attendance")
            .select("id")
            .eq("student_id", id)
            .limit(1);

    if (attendanceError) throw attendanceError;

    if (attendanceRecords?.length > 0) {
        throw new Error("HAS_HISTORY");
    }

    const { data: historyRecords, error: historyError } =
        await supabase
            .from("student_history")
            .select("student_id")
            .eq("student_id", id)
            .limit(1);

    if (historyError) throw historyError;

    if (historyRecords?.length > 0) {
        throw new Error("HAS_HISTORY");
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", id)
        .select("id");

    if (deleteError) throw deleteError;

    if (!deletedRows || deletedRows.length === 0) {
        throw new Error("ไม่สามารถลบข้อมูลได้ กรุณาตรวจสอบสิทธิ์ครู");
    }
}

async function handleDeleteStudent(student) {
    if (isSaving) return;

    const confirmed = window.confirm(
        `ยืนยันการลบนักเรียนหรือไม่?\n\n` +
        `รหัส: ${student.student_code}\n` +
        `ชื่อ: ${student.full_name}\n\n` +
        `หากมีประวัติการเช็กชื่อหรือประวัติการเปลี่ยนแปลง จะไม่สามารถลบได้`
    );

    if (!confirmed) return;

    isSaving = true;

    try {
        await deleteStudent(student.id);

        await loadStudents();

        showToast("ลบข้อมูลนักเรียนสำเร็จ");

    } catch (error) {
        console.error("Delete student error:", error);

        if (error.message === "HAS_HISTORY" || error.code === "23503") {
            showToast("นักเรียนมีประวัติหรือข้อมูลเชื่อมโยง ไม่สามารถลบได้");
        } else {
            showToast(error.message || "ลบข้อมูลไม่สำเร็จ");
        }

    } finally {
        isSaving = false;
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSaving) return;

    const id = $("editStudentId").value;

    const code = $("studentCode").value.trim();
    const name = $("studentName").value.trim();
    const classroomId = classroomSelect.value;
    const status = statusSelect.value;

    if (!code || !name || !classroomId || !status) {
        showToast("กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
    }

    if (!getClassroomById(classroomId)) {
        showToast("ไม่พบห้องเรียนที่เลือก กรุณาโหลดหน้าใหม่");
        return;
    }

    const payload = {
        student_code: code,
        full_name: name,
        classroom_id: classroomId,
        student_status: status
    };

    isSaving = true;

    const submitButton = $("saveStudentBtn");
    submitButton.disabled = true;
    submitButton.textContent = "กำลังตรวจสอบ...";

    try {
        const duplicate = await hasDuplicateCode(
            code,
            classroomId,
            id
        );

        if (duplicate) {
            showToast("รหัสนักเรียนนี้มีอยู่แล้วในห้องที่เลือก");
            return;
        }

        submitButton.textContent = "กำลังบันทึก...";

        if (id) {
            await updateStudent(id, payload);
        } else {
            await createStudent(payload);
        }

        await loadStudents();

        closeModal();

        showToast(
            id
                ? "แก้ไขข้อมูลและบันทึกประวัติสำเร็จ"
                : "เพิ่มนักเรียนสำเร็จ"
        );

    } catch (error) {
        console.error("Save student error:", error);
        handleSaveError(error);

    } finally {
        isSaving = false;
        submitButton.disabled = false;
        submitButton.textContent = "บันทึกข้อมูล";
    }
});

$("addStudentBtn").addEventListener("click", () => {
    if (classrooms.length === 0) {
        showToast("กรุณาสร้างห้องเรียนก่อนเพิ่มนักเรียน");
        return;
    }

    openModal();
});

$("closeModalBtn").addEventListener("click", closeModal);
$("cancelModalBtn").addEventListener("click", closeModal);

searchInput.addEventListener("input", event => {
    renderStudents(event.target.value);
});

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeModal();
    }
});

async function initialize() {
    try {
        validateElements();

        const teacher = await requireTeacher();

        if (!teacher) return;

        await loadClassrooms();
        await loadStudents();

        console.log("Student management connected to Supabase.");

    } catch (error) {
        console.error("Initialization error:", error);
        showToast("โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
    }
}

initialize();
