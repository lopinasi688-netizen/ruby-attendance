document.addEventListener("DOMContentLoaded", () => {
    const html = document.documentElement;
    const navigation = document.querySelector(".navigation");

    // =====================================
    // SIDEBAR NAVIGATION INDICATOR
    // =====================================

    if (navigation) {
        const activeItem = navigation.querySelector(".nav-item.active");

        const indicator = document.createElement("div");
        indicator.className = "nav-indicator";
        navigation.prepend(indicator);

        function moveIndicator(item) {
            if (!item) return;

            indicator.style.width = `${item.offsetWidth}px`;
            indicator.style.height = `${item.offsetHeight}px`;
            indicator.style.transform =
                `translate(${item.offsetLeft}px, ${item.offsetTop}px)`;
        }

        if (activeItem) {
            requestAnimationFrame(() => moveIndicator(activeItem));
        }

        navigation.querySelectorAll(".nav-item").forEach((item) => {
            item.addEventListener("mouseenter", () => {
                moveIndicator(item);
            });

            item.addEventListener("focus", () => {
                moveIndicator(item);
            });
        });

        navigation.addEventListener("mouseleave", () => {
            moveIndicator(activeItem);
        });

        window.addEventListener("resize", () => {
            moveIndicator(activeItem);
        });
    }

    // =====================================
    // PAGE LOADER - INITIAL PAGE LOAD
    // =====================================

    let loaderTimeout = null;

    function hidePageLoader() {
        html.classList.remove("ruby-loading-on");

        if (loaderTimeout) {
            clearTimeout(loaderTimeout);
            loaderTimeout = null;
        }
    }

    let isPageTransition = false;

    try {
        isPageTransition =
            sessionStorage.getItem("rubyPageTransition") === "1";

        if (isPageTransition) {
            sessionStorage.removeItem("rubyPageTransition");
        }
    } catch (error) {
        console.warn("Loading storage unavailable:", error);
    }

    if (isPageTransition) {
        // หน้าใหม่โหลดเสร็จแล้วจึงซ่อน Loading
        if (document.readyState === "complete") {
            setTimeout(hidePageLoader, 300);
        } else {
            window.addEventListener(
                "load",
                () => {
                    setTimeout(hidePageLoader, 300);
                },
                { once: true }
            );
        }

        // ระบบสำรอง ป้องกัน Loading ค้าง
        loaderTimeout = setTimeout(() => {
            hidePageLoader();
        }, 8000);
    } else {
        // กรณีเปิดหน้าโดยตรง ไม่ต้องแสดง Loading
        hidePageLoader();
    }

    // =====================================
    // PAGE NAVIGATION
    // =====================================

    document.querySelectorAll(
        ".nav-item, .primary-button, .secondary-button"
    ).forEach((link) => {
        link.addEventListener("click", (event) => {

            // ไม่ขัดขวางการเปิดลิงก์ด้วยปุ่มพิเศษ
            if (
                event.defaultPrevented ||
                (event.button !== 0 && event.button !== undefined) ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const href = link.getAttribute("href");

            if (!href || href.startsWith("#")) return;
            if (link.target === "_blank") return;

            let destination;

            try {
                destination = new URL(href, window.location.href);
            } catch (error) {
                return;
            }

            // ไม่เปลี่ยนหน้าไปเว็บไซต์ภายนอก
            if (destination.origin !== window.location.origin) return;

            // ไม่ทำงานเมื่อกดหน้าปัจจุบันซ้ำ
            if (destination.href === window.location.href) return;

            event.preventDefault();

            // แสดง Loading ทันที
            html.classList.add("ruby-loading-on");

            try {
                sessionStorage.setItem("rubyPageTransition", "1");
            } catch (error) {
                console.warn("Cannot save loading state:", error);
            }

            // เปลี่ยนหน้า
            window.location.href = destination.href;
        });
    });
});