
/* =================================
   RUBY ATTENDANCE
   APPLICATION SCRIPT
================================= */

// แสดงวันที่ปัจจุบันภาษาไทย
function updateCurrentDate() {
    const dateElement = document.getElementById("currentDate");

    if (!dateElement) return;

    const today = new Date();

    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };

    dateElement.textContent = today.toLocaleDateString(
        "th-TH",
        options
    );
}

// เริ่มต้นระบบ
document.addEventListener("DOMContentLoaded", () => {

    updateCurrentDate();

    console.log(
        "ระบบเช็คชื่อนักเรียน initialized successfully."
    );

});
