
import { supabase } from "./supabase.js";
import { requireTeacher } from "./auth.js";

let historyRecords = [];
let studentMap = new Map();

const $ = id => document.getElementById(id);

const historyList = $("historyList");
const historyLoading = $("historyLoading");
const historyEmpty = $("historyEmpty");
const historyCount = $("historyCount");
const searchInput = $("historySearch");
const typeFilter = $("historyTypeFilter");

const STATUS_LABELS = {
    studying: "กำลังศึกษา",
    suspended: "พักการเรียน",
    transferred: "ย้ายออก",
    graduated: "พ้นสภาพ"
};

const EVENT_LABELS = {
    room_transfer: "การย้ายห้อง",
    status_change: "การเปลี่ยนสถานะ"
};

function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function formatDate(value) {
    if (!value) return "ไม่ระบุวันเวลา";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "วันเวลาไม่ถูกต้อง";
    }

    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "long",
        timeStyle: "short"
    }).format(date);
}

function getStudent(studentId) {
    return studentMap.get(studentId) || {
        full_name: "ไม่พบข้อมูลนักเรียน",
        student_code: "-"
    };
}

function getStatusLabel(status) {
    if (!status) return "ไม่ระบุ";

    return STATUS_LABELS[status] || status;
}

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    element.textContent = text;

    return element;
}

function createHistoryCard(record) {
    const student = getStudent(record.student_id);

    const card = createElement("article", "history-item");

    const top = createElement("div", "history-item-top");

    const studentInfo = document.createElement("div");

    const studentName = createElement(
        "div",
        "history-student-name",
        student.full_name
    );

    const studentCode = createElement(
        "span",
        "history-student-code",
        `รหัสนักเรียน: ${student.student_code}`
    );

    studentInfo.append(studentName, studentCode);

    const date = createElement(
        "div",
        "history-date",
        formatDate(record.changed_at)
    );

    top.append(studentInfo, date);

    const type = createElement(
        "span",
        "history-type",
        EVENT_LABELS[record.event_type] || record.event_type || "ไม่ทราบประเภท"
    );

    const detail = createElement("div", "history-detail");

    if (record.event_type === "room_transfer") {
        const oldRoom = record.from_classroom_name || "ไม่ระบุห้องเดิม";
        const newRoom = record.to_classroom_name || "ไม่ระบุห้องใหม่";

        detail.append(
            createElement("strong", "", "ห้องเดิม: "),
            document.createTextNode(oldRoom),
            document.createElement("br"),
            createElement("strong", "", "ห้องใหม่: "),
            document.createTextNode(newRoom)
        );

    } else if (record.event_type === "status_change") {
        detail.append(
            createElement("strong", "", "สถานะเดิม: "),
            document.createTextNode(getStatusLabel(record.old_status)),
            document.createElement("br"),
            createElement("strong", "", "สถานะใหม่: "),
            document.createTextNode(getStatusLabel(record.new_status))
        );

    } else {
        detail.textContent = "ไม่มีรายละเอียดสำหรับประวัติประเภทนี้";
    }

    card.append(top, type, detail);

    if (record.note) {
        const note = createElement("div", "history-note");

        const noteLabel = createElement("strong", "", "หมายเหตุ: ");

        note.append(
            noteLabel,
            document.createTextNode(record.note)
        );

        card.appendChild(note);
    }

    return card;
}

function renderHistory() {
    historyList.innerHTML = "";

    const keyword = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;

    const filtered = historyRecords.filter(record => {
        const student = getStudent(record.student_id);

        const matchesSearch =
            String(student.full_name || "").toLowerCase().includes(keyword) ||
            String(student.student_code || "").toLowerCase().includes(keyword);

        const matchesType =
            selectedType === "all" ||
            record.event_type === selectedType;

        return matchesSearch && matchesType;
    });

    historyCount.textContent =
        `แสดง ${filtered.length.toLocaleString("th-TH")} จาก ${historyRecords.length.toLocaleString("th-TH")} รายการ`;

    historyEmpty.style.display =
        filtered.length === 0 ? "block" : "none";

    filtered.forEach(record => {
        historyList.appendChild(createHistoryCard(record));
    });
}

async function loadHistory() {
    historyLoading.style.display = "block";
    historyList.innerHTML = "";
    historyEmpty.style.display = "none";
    historyCount.textContent = "กำลังโหลดข้อมูล...";

    try {
        const { data, error } = await supabase
            .from("student_history")
            .select(`
                id,
                student_id,
                event_type,
                from_classroom_name,
                to_classroom_name,
                old_status,
                new_status,
                note,
                changed_at
            `)
            .order("changed_at", { ascending: false });

        if (error) throw error;

        historyRecords = data || [];

        // ดึงข้อมูลนักเรียนที่เกี่ยวข้องกับประวัติทั้งหมด
        const studentIds = [
            ...new Set(
                historyRecords
                    .map(record => record.student_id)
                    .filter(Boolean)
            )
        ];

        studentMap.clear();

        if (studentIds.length > 0) {
            const { data: studentsData, error: studentsError } =
                await supabase
                    .from("students")
                    .select("id, student_code, full_name")
                    .in("id", studentIds);

            if (studentsError) throw studentsError;

            (studentsData || []).forEach(student => {
                studentMap.set(student.id, student);
            });
        }

        renderHistory();

    } catch (error) {
        console.error("Load student history error:", error);

        historyRecords = [];
        studentMap.clear();

        historyCount.textContent = "โหลดข้อมูลไม่สำเร็จ";

        showToast(
            error.message || "ไม่สามารถโหลดประวัตินักเรียนได้"
        );

    } finally {
        historyLoading.style.display = "none";
    }
}

searchInput.addEventListener("input", renderHistory);
typeFilter.addEventListener("change", renderHistory);

$("refreshHistoryBtn").addEventListener("click", loadHistory);

async function initialize() {
    try {
        const teacher = await requireTeacher();

        if (!teacher) return;

        await loadHistory();

        console.log("Student history connected to Supabase.");

    } catch (error) {
        console.error("Student history initialization error:", error);
        showToast("ไม่สามารถเปิดหน้าประวัตินักเรียนได้");
    }
}

initialize();
