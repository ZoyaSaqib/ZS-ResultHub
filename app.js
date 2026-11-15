
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const API = "/api";

    const authContainer = document.querySelector(".auth-container");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const authMessage = document.getElementById("auth-message");

    let token = sessionStorage.getItem("resultHubToken");
    let dashboard = null;
    let selectedClassId = null;
    let editingStudentId = null;

    // ==========================================
    // API REQUEST HELPER
    // ==========================================

    async function apiRequest(endpoint, options = {}) {
        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || `Request failed (${response.status})`
            );
        }

        return data;
    }

    // ==========================================
    // MESSAGE HELPERS
    // ==========================================

    function showMessage(message, type = "info") {
        if (!authMessage) return;

        authMessage.textContent = message;
        authMessage.className = `auth-message ${type}`;
    }

    function clearMessage() {
        if (!authMessage) return;

        authMessage.textContent = "";
        authMessage.className = "auth-message";
    }

    function setButtonLoading(button, loading, normalText) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = loading ? "Please wait..." : normalText;
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    // ==========================================
    // LOGIN / REGISTER TABS
    // ==========================================

    function showLogin() {
        loginForm.style.display = "flex";
        registerForm.style.display = "none";

        document.getElementById("login-tab").classList.add("active");
        document.getElementById("register-tab").classList.remove("active");

        document.getElementById("auth-heading").textContent =
            "Teacher Login";

        document.getElementById("auth-subtitle").textContent =
            "Welcome back! Please enter your details.";

        clearMessage();
    }

    function showRegister() {
        loginForm.style.display = "none";
        registerForm.style.display = "flex";

        document.getElementById("register-tab").classList.add("active");
        document.getElementById("login-tab").classList.remove("active");

        document.getElementById("auth-heading").textContent =
            "Create Account";

        document.getElementById("auth-subtitle").textContent =
            "Join ResultHub as a teacher.";

        clearMessage();
    }

    window.showLogin = showLogin;
    window.showRegister = showRegister;

    // ==========================================
    // REGISTRATION
    // ==========================================

    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const button = registerForm.querySelector(
            'button[type="submit"]'
        );

        const name = document.getElementById("register-name").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;

        if (name.length < 2) {
            showMessage("Please enter your full name.", "error");
            return;
        }

        if (password.length < 10) {
            showMessage(
                "Password must contain at least 10 characters.",
                "error"
            );
            return;
        }

        setButtonLoading(button, true, "Create Teacher Account →");
        showMessage("Creating your account...", "info");

        try {
            await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            registerForm.reset();
            document.getElementById("login-email").value = email;

            showLogin();

            showMessage(
                "Account created successfully! You can now log in.",
                "success"
            );

        } catch (error) {
            showMessage(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Create Teacher Account →"
            );
        }
    });

    // ==========================================
    // LOGIN
    // ==========================================

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const button = loginForm.querySelector(
            'button[type="submit"]'
        );

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        setButtonLoading(button, true, "Login to Dashboard →");
        showMessage("Checking your account...", "info");

        try {
            const result = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            if (!result.access_token) {
                throw new Error("Login token was not returned.");
            }

            token = result.access_token;
            sessionStorage.setItem("resultHubToken", token);

            loginForm.reset();

            await loadTeacherDashboard();

        } catch (error) {
            token = null;
            sessionStorage.removeItem("resultHubToken");

            showMessage(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Login to Dashboard →"
            );
        }
    });

    // ==========================================
    // CREATE DASHBOARD
    // ==========================================

    function createDashboard() {
        if (dashboard) return dashboard;

        dashboard = document.createElement("section");
        dashboard.id = "teacherDashboard";
        dashboard.className = "teacher-dashboard";

        dashboard.innerHTML = `
            <div class="dashboard-header">
                <div>
                    <span class="eyebrow">YOUR WORKSPACE</span>
                    <h2>Teacher Dashboard</h2>
                    <p id="teacherWelcome">Welcome, Teacher!</p>
                </div>

                <button
                    type="button"
                    id="logoutButton"
                    class="logout-button">
                    Logout
                </button>
            </div>

            <div class="dashboard-content">

                <div class="dashboard-card">
                    <h3>Add a Class</h3>
                    <p>Organize your teaching classes.</p>

                    <form id="classForm">
                        <label for="className">Class Name</label>

                        <input
                            type="text"
                            id="className"
                            placeholder="Example: Class 9 Biology"
                            maxlength="50"
                            required
                        >

                        <button type="submit" class="auth-button">
                            + Add Class
                        </button>

                        <p
                            id="classMessage"
                            class="form-message"
                            role="status">
                        </p>
                    </form>
                </div>

                <div class="dashboard-card">
                    <h3>My Classes</h3>

                    <div id="classList">
                        <p>Loading classes...</p>
                    </div>
                </div>

                <div
                    class="dashboard-card student-manager"
                    id="studentManager"
                    style="display:none;">

                    <h3>Student Management</h3>
                    <p id="selectedClassName"></p>

                    <form id="studentForm">
                        <label for="studentName">Student Name</label>

                        <input
                            type="text"
                            id="studentName"
                            placeholder="Enter student name"
                            minlength="2"
                            maxlength="120"
                            required
                        >

                        <label for="studentRoll">Roll Number</label>

                        <input
                            type="text"
                            id="studentRoll"
                            placeholder="Enter roll number"
                            maxlength="50"
                            required
                        >

                        <button
                            type="submit"
                            class="auth-button"
                            id="addStudentButton">
                            + Add Student
                        </button>

                        <p
                            id="studentMessage"
                            class="form-message"
                            role="status">
                        </p>
                    </form>

                    <hr>

                    <h3>Students in This Class</h3>

                    <div id="studentList">
                        <p>Loading students...</p>
                    </div>
                </div>

            </div>
        `;

        document.getElementById("teacher-auth").appendChild(dashboard);

        // Dashboard event listeners

        document.getElementById("logoutButton").addEventListener(
            "click",
            logout
        );

        document.getElementById("classForm").addEventListener(
            "submit",
            addClass
        );

        document.getElementById("classList").addEventListener(
            "click",
            handleClassActions
        );

        document.getElementById("studentForm").addEventListener(
            "submit",
            addStudent
        );

        document.getElementById("studentList").addEventListener(
            "click",
            handleStudentActions
        );

        // Edit popup event listeners

        const editForm = document.getElementById("editStudentForm");
        const closeButton = document.getElementById("closeEditModal");
        const modal = document.getElementById("editStudentModal");

        if (editForm) {
            editForm.addEventListener(
                "submit",
                saveStudentChanges
            );
        }

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeStudentModal
            );
        }

        if (modal) {
            modal.addEventListener("click", event => {
                if (event.target === modal) {
                    closeStudentModal();
                }
            });
        }

        return dashboard;
    }

    // ==========================================
    // LOAD DASHBOARD
    // ==========================================

    async function loadTeacherDashboard() {
        const teacher = await apiRequest("/auth/me");

        createDashboard();

        document.getElementById("teacherWelcome").textContent =
            `Welcome, ${teacher.name || "Teacher"}!`;

        authContainer.style.display = "none";
        dashboard.style.display = "block";

        await loadClasses();

        dashboard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // ==========================================
    // ADD CLASS
    // ==========================================

    async function addClass(event) {
        event.preventDefault();

        const form = document.getElementById("classForm");
        const button = form.querySelector('button[type="submit"]');
        const message = document.getElementById("classMessage");

        const className = document.getElementById("className").value.trim();

        if (!className) {
            message.textContent = "Please enter a class name.";
            message.className = "form-message error";
            return;
        }

        setButtonLoading(button, true, "+ Add Class");

        try {
            await apiRequest("/classes", {
                method: "POST",
                body: JSON.stringify({
                    class_name: className
                })
            });

            form.reset();

            message.textContent = "Class added successfully!";
            message.className = "form-message success";

            await loadClasses();

        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";

        } finally {
            setButtonLoading(button, false, "+ Add Class");
        }
    }

    // ==========================================
    // LOAD CLASSES
    // ==========================================

    async function loadClasses() {
        const classList = document.getElementById("classList");

        if (!classList) return;

        try {
            const classes = await apiRequest("/classes");

            if (!Array.isArray(classes) || classes.length === 0) {
                classList.innerHTML = `
                    <p class="empty-classes">
                        No classes added yet. Add your first class!
                    </p>
                `;

                selectedClassId = null;

                document.getElementById("studentManager").style.display =
                    "none";

                return;
            }

            if (
                selectedClassId !== null &&
                !classes.some(
                    item => String(item.id) === String(selectedClassId)
                )
            ) {
                selectedClassId = null;

                document.getElementById("studentManager").style.display =
                    "none";
            }

            classList.innerHTML = classes.map(item => `
                <div class="class-item">

                    <div class="class-details">
                        <strong>📚 ${escapeHTML(item.class_name)}</strong>
                        <small>Class ID: ${escapeHTML(item.id)}</small>
                    </div>

                    <div class="class-actions">

                        <button
                            type="button"
                            class="edit-class-button"
                            data-action="edit"
                            data-id="${escapeHTML(item.id)}">
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-class-button"
                            data-action="delete"
                            data-id="${escapeHTML(item.id)}">
                            Delete
                        </button>

                        <button
                            type="button"
                            class="manage-students-button"
                            data-action="students"
                            data-id="${escapeHTML(item.id)}"
                            data-name="${escapeHTML(item.class_name)}">
                            Manage Students
                        </button>

                    </div>
                </div>
            `).join("");

        } catch (error) {
            classList.textContent = error.message;
        }
    }

    // ==========================================
    // CLASS ACTIONS
    // ==========================================

    async function handleClassActions(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const classId = button.dataset.id;
        const action = button.dataset.action;

        if (!/^\d+$/.test(classId)) return;

        if (action === "edit") {
            await editClass(classId, button);
        }

        if (action === "delete") {
            await deleteClass(classId, button);
        }

        if (action === "students") {
            await openStudentManager(classId, button.dataset.name);
        }
    }

    // ==========================================
    // EDIT CLASS
    // ==========================================

    async function editClass(classId, button) {
        const currentName = button
            .closest(".class-item")
            .querySelector(".class-details strong")
            .textContent
            .replace("📚 ", "");

        const newName = prompt(
            "Enter the new class name:",
            currentName
        );

        if (newName === null) return;

        const updatedName = newName.trim();

        if (!updatedName) {
            alert("Class name cannot be empty.");
            return;
        }

        if (updatedName.length > 50) {
            alert("Class name cannot exceed 50 characters.");
            return;
        }

        if (updatedName === currentName) return;

        button.disabled = true;

        try {
            await apiRequest(`/classes/${classId}`, {
                method: "PUT",
                body: JSON.stringify({
                    class_name: updatedName
                })
            });

            alert("Class updated successfully!");

            await loadClasses();

        } catch (error) {
            alert(error.message);

        } finally {
            button.disabled = false;
        }
    }

    // ==========================================
    // DELETE CLASS
    // ==========================================

    async function deleteClass(classId, button) {
        const classItem = button.closest(".class-item");

        const className = classItem
            .querySelector(".class-details strong")
            .textContent
            .replace("📚 ", "");

        if (!confirm(`Are you sure you want to delete "${className}"?`)) {
            return;
        }

        button.disabled = true;

        try {
            await apiRequest(`/classes/${classId}`, {
                method: "DELETE"
            });

            alert("Class deleted successfully!");

            await loadClasses();

        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    }

    // ==========================================
    // OPEN STUDENT MANAGER
    // ==========================================

    async function openStudentManager(classId, className) {
        selectedClassId = classId;

        const manager = document.getElementById("studentManager");

        manager.style.display = "block";

        document.getElementById("selectedClassName").textContent =
            `Managing students for: ${className}`;

        document.getElementById("studentForm").reset();

        const message = document.getElementById("studentMessage");

        message.textContent = "";
        message.className = "form-message";

        manager.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        await loadStudents();
    }

    // ==========================================
    // ADD STUDENT
    // ==========================================

    async function addStudent(event) {
        event.preventDefault();

        if (!selectedClassId) return;

        const form = document.getElementById("studentForm");
        const button = document.getElementById("addStudentButton");
        const message = document.getElementById("studentMessage");

        const name = document.getElementById("studentName").value.trim();
        const rollNumber = document.getElementById("studentRoll").value.trim();

        if (name.length < 2 || name.length > 120) {
            message.textContent =
                "Student name must contain 2–120 characters.";

            message.className = "form-message error";
            return;
        }

        if (!rollNumber || rollNumber.length > 50) {
            message.textContent = "Please enter a valid roll number.";
            message.className = "form-message error";
            return;
        }

        setButtonLoading(button, true, "+ Add Student");

        try {
            await apiRequest(
                `/classes/${selectedClassId}/students`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        roll_number: rollNumber
                    })
                }
            );

            form.reset();

            message.textContent = "Student added successfully!";
            message.className = "form-message success";

            await loadStudents();

        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";

        } finally {
            setButtonLoading(button, false, "+ Add Student");
        }
    }

    // ==========================================
    // LOAD STUDENTS
    // ==========================================

    async function loadStudents() {
        const studentList = document.getElementById("studentList");

        if (!studentList || !selectedClassId) return;

        studentList.innerHTML = "<p>Loading students...</p>";

        try {
            const students = await apiRequest(
                `/classes/${selectedClassId}/students`
            );

            if (!Array.isArray(students) || students.length === 0) {
                studentList.innerHTML = `
                    <p class="empty-classes">
                        No students added to this class yet.
                    </p>
                `;

                return;
            }

            studentList.innerHTML = `
                <div class="student-count">
                    Total Students: ${students.length}
                </div>

                ${students.map(student => `
                    <div class="student-item">

                        <div class="student-details">
                            <strong>${escapeHTML(student.name)}</strong>

                            <small>
                                Roll Number: ${escapeHTML(student.roll_number)}
                            </small>
                        </div>

                        <div class="student-actions">

                            <button
                                type="button"
                                class="edit-student-button"
                                data-action="edit-student"
                                data-id="${escapeHTML(student.id)}">
                                Edit
                            </button>

                            <button
                                type="button"
                                class="delete-student-button"
                                data-action="delete-student"
                                data-id="${escapeHTML(student.id)}">
                                Delete
                            </button>

                        </div>
                    </div>
                `).join("")}
            `;

        } catch (error) {
            studentList.textContent = error.message;
        }
    }

    // ==========================================
    // STUDENT ACTIONS
    // ==========================================

    async function handleStudentActions(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const studentId = button.dataset.id;
        const action = button.dataset.action;

        if (!/^\d+$/.test(studentId)) return;

        if (action === "edit-student") {
            editStudent(studentId, button);
        }

        if (action === "delete-student") {
            await deleteStudent(studentId, button);
        }
    }

    // ==========================================
    // EDIT STUDENT - OPEN POPUP
    // ==========================================

    function editStudent(studentId, button) {
        const modal = document.getElementById("editStudentModal");
        const nameInput = document.getElementById("editStudentName");
        const rollInput = document.getElementById("editStudentRoll");

        if (!modal || !nameInput || !rollInput) {
            const message = document.getElementById("studentMessage");

            if (message) {
                message.textContent =
                    "Edit Student popup is missing from index.html.";

                message.className = "form-message error";
            }

            return;
        }

        const studentItem = button.closest(".student-item");

        const currentName = studentItem
            .querySelector(".student-details strong")
            .textContent;

        const currentRoll = studentItem
            .querySelector(".student-details small")
            .textContent
            .replace("Roll Number: ", "")
            .trim();

        editingStudentId = studentId;

        nameInput.value = currentName;
        rollInput.value = currentRoll;

        const message = document.getElementById("editStudentMessage");

        message.textContent = "";
        message.className = "form-message";

        modal.style.display = "flex";

        nameInput.focus();
    }

    // ==========================================
    // CLOSE STUDENT POPUP
    // ==========================================

    function closeStudentModal() {
        const modal = document.getElementById("editStudentModal");
        const form = document.getElementById("editStudentForm");
        const message = document.getElementById("editStudentMessage");

        if (modal) {
            modal.style.display = "none";
        }

        if (form) {
            form.reset();
        }

        if (message) {
            message.textContent = "";
            message.className = "form-message";
        }

        editingStudentId = null;
    }

    // Close popup with Escape key

    document.addEventListener("keydown", event => {
        const modal = document.getElementById("editStudentModal");

        if (
            event.key === "Escape" &&
            modal &&
            modal.style.display === "flex"
        ) {
            closeStudentModal();
        }
    });

    // ==========================================
    // SAVE STUDENT CHANGES
    // ==========================================

    async function saveStudentChanges(event) {
        event.preventDefault();

        if (!editingStudentId || !selectedClassId) return;

        const button = document.getElementById("saveStudentButton");
        const message = document.getElementById("editStudentMessage");

        const name = document.getElementById("editStudentName").value.trim();
        const roll = document.getElementById("editStudentRoll").value.trim();

        if (name.length < 2 || name.length > 120) {
            message.textContent =
                "Name must contain 2–120 characters.";

            message.className = "form-message error";
            return;
        }

        if (!roll || roll.length > 50) {
            message.textContent = "Please enter a valid roll number.";
            message.className = "form-message error";
            return;
        }

        setButtonLoading(button, true, "Save Changes");

        try {
            await apiRequest(
                `/classes/${selectedClassId}/students/${editingStudentId}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name,
                        roll_number: roll
                    })
                }
            );

            closeStudentModal();

            await loadStudents();

            const studentMessage =
                document.getElementById("studentMessage");

            studentMessage.textContent =
                "Student updated successfully!";

            studentMessage.className = "form-message success";

        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";

        } finally {
            setButtonLoading(button, false, "Save Changes");
        }
    }

    // ==========================================
    // DELETE STUDENT
    // ==========================================

    async function deleteStudent(studentId, button) {
        const studentItem = button.closest(".student-item");

        const studentName = studentItem
            .querySelector(".student-details strong")
            .textContent;

        if (!confirm(`Delete student "${studentName}"?`)) {
            return;
        }

        button.disabled = true;

        try {
            await apiRequest(
                `/classes/${selectedClassId}/students/${studentId}`,
                {
                    method: "DELETE"
                }
            );

            await loadStudents();

            const message = document.getElementById("studentMessage");

            message.textContent = "Student deleted successfully!";
            message.className = "form-message success";

        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    }

    // ==========================================
    // LOGOUT
    // ==========================================

    function logout() {
        token = null;
        selectedClassId = null;
        editingStudentId = null;

        sessionStorage.removeItem("resultHubToken");

        closeStudentModal();

        if (dashboard) {
            dashboard.style.display = "none";
        }

        authContainer.style.display = "grid";

        showLogin();

        showMessage(
            "You have logged out successfully.",
            "success"
        );

        document.getElementById("teacher-auth").scrollIntoView({
            behavior: "smooth"
        });
    }

    // ==========================================
    // RESTORE SESSION
    // ==========================================

    async function restoreSession() {
        if (!token) return;

        try {
            await loadTeacherDashboard();

        } catch (error) {
            token = null;

            sessionStorage.removeItem("resultHubToken");

            if (dashboard) {
                dashboard.style.display = "none";
            }

            authContainer.style.display = "grid";

            showMessage(
                "Your session has expired. Please log in again.",
                "error"
            );
        }
    }

    // ==========================================
    // BACKEND HEALTH CHECK
    // ==========================================

    async function checkBackend() {
        try {
            const result = await apiRequest("/health");

            console.log("Backend connected:", result.status);

        } catch (error) {
            console.warn(
                "Backend connection issue:",
                error.message
            );
        }
    }

    // ==========================================
    // INITIALIZE
    // ==========================================

    checkBackend();
    restoreSession();

    console.log(
        "ResultHub Pakistan is ready. Official board result integrations are pending."
    );

});
// ==========================================
    // PUBLIC RESULT SEARCH
    // ==========================================
    const resultSearchForm = document.getElementById("resultSearchForm");

    if (resultSearchForm) {
        resultSearchForm.addEventListener("submit", async event => {
            event.preventDefault();

            const rollNumber = document.getElementById("searchRollNumber").value.trim();
            const displayDiv = document.getElementById("searchResultDisplay");

            if (!rollNumber) return;

            displayDiv.innerHTML = "<p style='text-align: center; color: var(--muted);'>Searching result...</p>";

            try {
                // Fetch result from backend API
                const response = await fetch(`/api/results/search?roll_number=${encodeURIComponent(rollNumber)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || "Result not found.");
                }

                let resultsHtml = data.results.map(r => `
                    <div style="background: #f8fbf9; border: 1px solid var(--border); padding: 18px; border-radius: 10px; margin-top: 12px;">
                        <p style="margin-bottom: 5px;"><strong>Exam / Term:</strong> ${escapeHTML(r.exam_type)}</p>
                        <p style="margin-bottom: 5px;"><strong>Marks Obtained:</strong> ${escapeHTML(r.obtained_marks)} / ${escapeHTML(r.total_marks)}</p>
                        <p style="margin-bottom: 5px;"><strong>Grade:</strong> <span style="color: var(--primary); font-weight: bold;">${escapeHTML(r.grade)}</span></p>
                        ${r.remarks ? `<p style="margin-top: 8px; color: var(--muted);"><strong>Remarks:</strong> ${escapeHTML(r.remarks)}</p>` : ''}
                    </div>
                `).join("");

                displayDiv.innerHTML = `
                    <div style="background: #e9f6ef; padding: 16px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #cce9dc;">
                        <p style="color: #16734e; font-weight: 700; margin-bottom: 4px;">Student Found:</p>
                        <strong>Name:</strong> ${escapeHTML(data.student_name)}<br>
                        <strong>Roll Number:</strong> ${escapeHTML(data.roll_number)}
                    </div>
                    <h4 style="font-family: 'Manrope', sans-serif; margin-bottom: 5px;">Result Records:</h4>
                    ${resultsHtml || "<p style='color: var(--muted);'>No result records found for this student.</p>"}
                `;

            } catch (error) {
                displayDiv.innerHTML = `
                    <div style="background: #fff0f0; color: #c0392b; padding: 15px; border-radius: 8px; text-align: center;">
                        ${escapeHTML(error.message)}
                    </div>
                `;
            }
        });
    }