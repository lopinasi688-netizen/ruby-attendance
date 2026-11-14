
/* =================================
   REPORTS SYSTEM
   SUPABASE ATTENDANCE REPORTS
================================= */

import { supabase } from "./supabase.js";
import { requireTeacher } from "./auth.js";

// =================================
// ELEMENTS
// =================================

const classroomSelect = document.getElementById("reportClassroom");
const startDateInput = document.getElementById("reportStartDate");
const endDateInput = document.getElementById("reportEndDate");
const semesterSelect = document.getElementById("reportSemester");

const loadingElement = document.getElementById("reportLoading");
const contentElement = document.getElementById("reportContent");
const errorElement = document.getElementById("reportError");
const errorMessage = document.getElementById("reportErrorMessage");

const applyButton = document.getElementById("applyReportFilter");
const resetButton = document.getElementById("resetReportFilter");
const refreshButton = document.getElementById("refreshReport");
const retryButton = document.getElementById("retryReport");

const classroomBody = document.getElementById("classroomReportBody");
const dailyBody = document.getElementById("dailyReportBody");

// =================================
// STATE
// =================================

let classrooms = [];
let classroomMap = new Map();
let attendanceRecords = [];
let isLoading = false;

const PAGE_SIZE = 1000;

const STATUS_KEYS = [
    "present",
    "absent",
    "late",
    "leave"
];

// =================================
// DATE
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
// CLASSROOMS
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
// LOAD ALL MATCHING RECORDS
// =================================

async function loadAttendanceRecords() {
    const classroomId = classroomSelect.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const semester = semesterSelect.value;

    const allRecords = [];

    let from = 0;

    while (true) {
        let query = supabase
            .from("attendance")
            .select(`
                student_id,
                classroom_id,
                semester,
                attendance_date,
                status
            `)
            .order("attendance_date", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

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

        const { data, error } = await query;

        if (error) throw error;

        const batch = data || [];

        allRecords.push(...batch);

        if (batch.length < PAGE_SIZE) break;

        from += PAGE_SIZE;
    }

    attendanceRecords = allRecords;
}

// =================================
// COUNT
// =================================

function createCounts(records) {
    const counts = {
        total: records.length,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0
    };

    records.forEach(record => {
        if (STATUS_KEYS.includes(record.status)) {
            counts[record.status]++;
        }
    });

    return counts;
}

// =================================
// PERCENTAGE
// =================================

function getAttendanceRate(counts) {
    if (!counts.total) return 0;

    return (
        (counts.present + counts.late) / counts.total
    ) * 100;
}

// =================================
// RENDER OVERALL SUMMARY
// =================================

function renderOverallSummary(records) {
    const counts = createCounts(records);

    document.getElementById("reportTotal").textContent =
        counts.total.toLocaleString("th-TH");

    document.getElementById("reportPresent").textContent =
        counts.present.toLocaleString("th-TH");

    document.getElementById("reportAbsent").textContent =
        counts.absent.toLocaleString("th-TH");

    document.getElementById("reportLate").textContent =
        counts.late.toLocaleString("th-TH");

    document.getElementById("reportLeave").textContent =
        counts.leave.toLocaleString("th-TH");

    const rate = getAttendanceRate(counts);

    document.getElementById("reportRate").textContent =
        `${rate.toFixed(1)}%`;

    document.getElementById("reportRateBar").style.width =
        `${rate}%`;

    const attended = counts.present + counts.late;

    document.getElementById("reportRateDetail").textContent =
        `${attended.toLocaleString("th-TH")} / ${counts.total.toLocaleString("th-TH")} รายการ`;
}

// =================================
// CLASSROOM SUMMARY
// =================================

function renderClassroomSummary(records) {
    const grouped = new Map();

    records.forEach(record => {
        const classroomId = record.classroom_id;

        if (!grouped.has(classroomId)) {
            grouped.set(classroomId, []);
        }

        grouped.get(classroomId).push(record);
    });

    const rows = [...grouped.entries()]
        .map(([classroomId, classroomRecords]) => {
            return {
                classroomId,
                counts: createCounts(classroomRecords)
            };
        })
        .sort((a, b) => {
            const nameA = classroomMap.get(a.classroomId) || "";
            const nameB = classroomMap.get(b.classroomId) || "";

            return nameA.localeCompare(nameB, "th");
        });

    classroomBody.innerHTML = "";

    rows.forEach(item => {
        const counts = item.counts;
        const rate = getAttendanceRate(counts);

        const row = document.createElement("tr");

        const values = [
            classroomMap.get(item.classroomId) || "ไม่พบห้องเรียน",
            counts.total,
            counts.present,
            counts.absent,
            counts.late,
            counts.leave,
            `${rate.toFixed(1)}%`
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");

            cell.textContent =
                typeof value === "number"
                    ? value.toLocaleString("th-TH")
                    : value;

            if (index === 0) {
                cell.style.fontWeight = "600";
            }

            row.appendChild(cell);
        });

        classroomBody.appendChild(row);
    });

    document.getElementById("classroomReportEmpty").hidden =
        rows.length !== 0;
}

// =================================
// DAILY SUMMARY
// =================================

function renderDailySummary(records) {
    const grouped = new Map();

    records.forEach(record => {
        const date = record.attendance_date;

        if (!grouped.has(date)) {
            grouped.set(date, []);
        }

        grouped.get(date).push(record);
    });

    const rows = [...grouped.entries()]
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

    dailyBody.innerHTML = "";

    rows.forEach(([date, dailyRecords]) => {
        const counts = createCounts(dailyRecords);

        const row = document.createElement("tr");

        const values = [
            formatDate(date),
            counts.total,
            counts.present,
            counts.absent,
            counts.late,
            counts.leave
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");

            cell.textContent =
                typeof value === "number"
                    ? value.toLocaleString("th-TH")
                    : value;

            if (index === 0) {
                cell.style.fontWeight = "600";
            }

            row.appendChild(cell);
        });

        dailyBody.appendChild(row);
    });

    document.getElementById("dailyReportEmpty").hidden =
        rows.length !== 0;
}

// =================================
// RENDER REPORT
// =================================

function renderReport() {
    renderOverallSummary(attendanceRecords);
    renderClassroomSummary(attendanceRecords);
    renderDailySummary(attendanceRecords);
}

// =================================
// LOAD REPORT
// =================================

async function loadReport() {
    if (isLoading) return;

    if (
        startDateInput.value &&
        endDateInput.value &&
        startDateInput.value > endDateInput.value
    ) {
        alert("วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด");
        return;
    }

    isLoading = true;

    loadingElement.hidden = false;
    contentElement.hidden = true;
    errorElement.hidden = true;

    try {
        await loadAttendanceRecords();

        renderReport();

        loadingElement.hidden = true;
        contentElement.hidden = false;

    } catch (error) {
        console.error("Load reports error:", error);

        loadingElement.hidden = true;
        errorElement.hidden = false;

        errorMessage.textContent =
            error.message || "เกิดข้อผิดพลาดในการประมวลผลรายงาน";

    } finally {
        isLoading = false;
    }
}

// =================================
// RESET FILTER
// =================================

function resetFilters() {
    classroomSelect.value = "";
    startDateInput.value = "";
    endDateInput.value = "";
    semesterSelect.value = "";

    loadReport();
}

// =================================
// EVENTS
// =================================

applyButton.addEventListener("click", loadReport);
resetButton.addEventListener("click", resetFilters);
refreshButton.addEventListener("click", loadReport);
retryButton.addEventListener("click", loadReport);

// =================================
// INITIALIZE
// =================================

async function initializeReports() {
    try {
        const auth = await requireTeacher();

        if (!auth) return;

        await loadClassrooms();
        await loadReport();

        console.log(
            "Attendance Reports connected to Supabase."
        );

    } catch (error) {
        console.error("Reports initialization error:", error);

        loadingElement.hidden = true;
        errorElement.hidden = false;

        errorMessage.textContent =
            error.message || "ไม่สามารถเริ่มต้นหน้ารายงานได้";
    }
}

initializeReports();
