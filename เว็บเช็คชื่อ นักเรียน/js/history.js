
/* =================================
   ประวัติการเข้าเรียน
   SUPABASE ATTENDANCE HISTORY
================================= */

import { supabase } from "./supabase.js";
import { requireTeacher } from "./auth.js";

// =================================
// ELEMENTS
// =================================

const classroomSelect = document.getElementById("historyClassroom");
const startDateInput = document.getElementById("historyStartDate");
const endDateInput = document.getElementById("historyEndDate");
const semesterSelect = document.getElementById("historySemester");
const statusSelect = document.getElementById("historyStatus");
const searchInput = document.getElementById("historySearch");

const tableBody = document.getElementById("historyTableBody");
const tableWrapper = document.getElementById("historyTableWrapper");

const loadingElement = document.getElementById("historyLoading");
const emptyElement = document.getElementById("historyEmpty");
const errorElement = document.getElementById("historyError");
const errorMessage = document.getElementById("historyErrorMessage");

const applyButton = document.getElementById("applyHistoryFilter");
const resetButton = document.getElementById("resetHistoryFilter");
const refreshButton = document.getElementById("refreshHistory");
const retryButton = document.getElementById("retryHistory");

// =================================
// STATE
// =================================

let classrooms = [];
let classroomMap = new Map();

let attendanceRecords = [];
let studentMap = new Map();

let isLoading = false;

// =================================
// LABELS
// =================================

const STATUS_LABELS = {
    present: "มาเรียน",
    absent: "ขาดเรียน",
    late: "มาสาย",
    leave: "ลา"
};

// =================================
// DATE FORMAT
// =================================

function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString + "T12:00:00");

    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// =================================
// CLASSROOM LABEL
// =================================

function getClassroomName(classroomId) {
    return classroomMap.get(classroomId) || "ไม่พบห้องเรียน";
}

// =================================
// LOAD CLASSROOMS
// =================================

async function loadClassrooms() {
    const { data, error } = await supabase
        .from("classrooms")
        .select("id, education_level, year_level, room_number, academic_year")
        .order("academic_year", { ascending: false })
        .order("year_level", { ascending: true })
        .order("room_number", { ascending: true });

    if (error) throw error;

    classrooms = data || [];

    classroomMap.clear();

    classroomSelect.innerHTML =
        '<option value="">ทุกห้องเรียน</option>';

    classrooms.forEach(classroom => {
        const name =
            `${classroom.education_level}${classroom.year_level}/${classroom.room_number}`;

        classroomMap.set(classroom.id, name);

        const option = document.createElement("option");

        option.value = classroom.id;
        option.textContent = name;

        classroomSelect.appendChild(option);
    });
}

// =================================
// LOAD ATTENDANCE
// =================================

async function loadHistory() {
    if (isLoading) return;

    isLoading = true;

    loadingElement.hidden = false;
    tableWrapper.hidden = true;
    emptyElement.hidden = true;
    errorElement.hidden = true;

    try {
        let query = supabase
            .from("attendance")
            .select(`
                id,
                student_id,
                classroom_id,
                academic_year,
                semester,
                attendance_date,
                status
            `)
            .order("attendance_date", { ascending: false });

        const classroomId = classroomSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const semester = semesterSelect.value;
        const status = statusSelect.value;

        if (classroomId) {
            query = query.eq("classroom_id", classroomId);
        }

        if (startDate) {
            query = query.gte("attendance_date", startDate);
        }

        if (endDate) {
            query = query.lte("attendance_date", endDate);
        }

        if (semester) {
            query = query.eq("semester", Number(semester));
        }

        if (status) {
            query = query.eq("status", status);
        }

        const { data, error } = await query;

        if (error) throw error;

        attendanceRecords = data || [];

        // โหลดข้อมูลนักเรียนที่เกี่ยวข้อง
        const studentIds = [
            ...new Set(
                attendanceRecords.map(record => record.student_id)
            )
        ];

        studentMap.clear();

        if (studentIds.length > 0) {
            const { data: studentData, error: studentError } =
                await supabase
                    .from("students")
                    .select("id, student_code, full_name")
                    .in("id", studentIds);

            if (studentError) throw studentError;

            (studentData || []).forEach(student => {
                studentMap.set(student.id, student);
            });
        }

        renderHistory();

        loadingElement.hidden = true;

    } catch (error) {
        console.error("Load attendance history error:", error);

        loadingElement.hidden = true;
        errorElement.hidden = false;

        errorMessage.textContent =
            error.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล";

    } finally {
        isLoading = false;
    }
}

// =================================
// RENDER HISTORY
// =================================

function renderHistory() {
    const keyword = searchInput.value.trim().toLowerCase();

    const filteredRecords = attendanceRecords.filter(record => {
        const student = studentMap.get(record.student_id);

        const code = String(student?.student_code || "").toLowerCase();
        const name = String(student?.full_name || "").toLowerCase();

        return (
            code.includes(keyword) ||
            name.includes(keyword)
        );
    });

    tableBody.innerHTML = "";

    filteredRecords.forEach(record => {
        const student = studentMap.get(record.student_id);

        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.textContent = formatDate(record.attendance_date);

        const codeCell = document.createElement("td");
        codeCell.className = "student-code";
        codeCell.textContent = student?.student_code || "-";

        const nameCell = document.createElement("td");
        nameCell.className = "student-name";
        nameCell.textContent = student?.full_name || "ไม่พบข้อมูลนักเรียน";

        const classroomCell = document.createElement("td");
        classroomCell.textContent =
            getClassroomName(record.classroom_id);

        const statusCell = document.createElement("td");

        const statusBadge = document.createElement("span");
        statusBadge.className =
            `history-status-badge ${record.status}`;

        statusBadge.textContent =
            STATUS_LABELS[record.status] || record.status || "-";

        statusCell.appendChild(statusBadge);

        const semesterCell = document.createElement("td");
        semesterCell.textContent =
            record.semester
                ? `ภาคเรียนที่ ${record.semester}`
                : "-";

        row.append(
            dateCell,
            codeCell,
            nameCell,
            classroomCell,
            statusCell,
            semesterCell
        );

        tableBody.appendChild(row);
    });

    updateStatistics(filteredRecords);

    tableWrapper.hidden = filteredRecords.length === 0;
    emptyElement.hidden = filteredRecords.length !== 0;
}

// =================================
// UPDATE STATISTICS
// =================================

function updateStatistics(records) {
    const counts = {
        present: 0,
        absent: 0,
        late: 0,
        leave: 0
    };

    records.forEach(record => {
        if (Object.hasOwn(counts, record.status)) {
            counts[record.status]++;
        }
    });

    document.getElementById("historyTotalCount").textContent =
        records.length;

    document.getElementById("historyPresentCount").textContent =
        counts.present;

    document.getElementById("historyAbsentCount").textContent =
        counts.absent;

    document.getElementById("historyLateCount").textContent =
        counts.late;

    document.getElementById("historyLeaveCount").textContent =
        counts.leave;
}

// =================================
// RESET FILTERS
// =================================

function resetFilters() {
    classroomSelect.value = "";
    startDateInput.value = "";
    endDateInput.value = "";
    semesterSelect.value = "";
    statusSelect.value = "";
    searchInput.value = "";

    loadHistory();
}

// =================================
// EVENTS
// =================================

applyButton.addEventListener("click", () => {
    if (
        startDateInput.value &&
        endDateInput.value &&
        startDateInput.value > endDateInput.value
    ) {
        alert("วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด");
        return;
    }

    loadHistory();
});

resetButton.addEventListener("click", resetFilters);

refreshButton.addEventListener("click", loadHistory);

retryButton.addEventListener("click", loadHistory);

searchInput.addEventListener("input", renderHistory);

// =================================
// INITIALIZE
// =================================

async function initializeHistory() {
    try {
        const auth = await requireTeacher();

        if (!auth) return;

        await loadClassrooms();
        await loadHistory();

        console.log(
            "Attendance History connected to Supabase."
        );

    } catch (error) {
        console.error("History initialization error:", error);

        loadingElement.hidden = true;
        errorElement.hidden = false;

        errorMessage.textContent =
            error.message || "ไม่สามารถเริ่มต้นหน้าประวัติได้";
    }
}

initializeHistory();
