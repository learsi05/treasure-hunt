let teams = [];
let routeData = {};
let clueImageUploads = {};
let liveProgressData = null;
let adminRefreshTimer = null;
let liveTimerInterval = null;


/* =========================================================
   PAGE STARTUP
========================================================= */

window.addEventListener("DOMContentLoaded", () => {

    checkAdminSession();


    const passwordInput =
        document.getElementById(
            "adminPassword"
        );


    if (passwordInput) {

        passwordInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    adminLogin();
                }
            }
        );
    }
});


async function checkAdminSession() {

    try {

        const response =
            await fetch(
                "/api/admin-session",
                {
                    cache: "no-store"
                }
            );


        if (response.ok) {

            showDashboard();
        }


    } catch (error) {

        console.error(
            "ADMIN SESSION ERROR:",
            error
        );
    }
}


/* =========================================================
   ADMIN LOGIN / LOGOUT
========================================================= */

async function adminLogin() {

    const password =
        document
            .getElementById(
                "adminPassword"
            )
            .value;


    const message =
        document
            .getElementById(
                "loginMessage"
            );


    if (!password) {

        message.className =
            "message error";


        message.innerText =
            "Enter the administrator password.";


        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin-login",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            password
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.className =
                "message error";


            message.innerText =
                result.message ||
                "Login failed.";


            return;
        }


        message.innerText =
            "";


        showDashboard();


    } catch (error) {

        console.error(
            "ADMIN LOGIN ERROR:",
            error
        );


        message.className =
            "message error";


        message.innerText =
            "Could not connect to the server.";
    }
}


async function adminLogout() {

    try {

        await fetch(
            "/api/admin-logout",
            {
                method: "POST"
            }
        );


    } catch (error) {

        console.error(
            "ADMIN LOGOUT ERROR:",
            error
        );
    }


    location.reload();
}


function showDashboard() {

    document
        .getElementById(
            "loginScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "dashboard"
        )
        .classList
        .remove("hidden");


    refreshAdminData();

    loadFinalQR();


    if (!adminRefreshTimer) {

        adminRefreshTimer =
            setInterval(
                refreshAdminData,
                2000
            );
    }


    if (!liveTimerInterval) {

        liveTimerInterval =
            setInterval(
                updateLiveTimer,
                1000
            );
    }
}


async function refreshAdminData() {

    await Promise.all([

        loadTeams(),

        loadAdminEventData()

    ]);
}


/* =========================================================
   NAVIGATION
========================================================= */

const sections = {

    overview:
        "Overview",

    teams:
        "Manage Teams",

    routes:
        "Route & QR Setup",

    event:
        "Event Control",

    progress:
        "Live Progress",

    results:
        "Results"

};


function openSection(name) {

    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );


    const matching =
        [...buttons]
            .find(
                button =>
                    button
                        .innerText
                        .toLowerCase()
                        .includes(
                            sections[name]
                                .toLowerCase()
                                .split(" ")[0]
                        )
            );


    showSection(
        name,
        matching
    );
}


function showSection(
    name,
    button
) {

    document
        .querySelectorAll(
            ".section"
        )
        .forEach(
            section => {

                section
                    .classList
                    .add(
                        "hidden"
                    );
            }
        );


    const target =
        document.getElementById(
            `${name}Section`
        );


    if (target) {

        target
            .classList
            .remove(
                "hidden"
            );
    }


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            nav => {

                nav
                    .classList
                    .remove(
                        "active"
                    );
            }
        );


    if (button) {

        button
            .classList
            .add(
                "active"
            );
    }


    const pageTitle =
        document.getElementById(
            "pageTitle"
        );


    if (pageTitle) {

        pageTitle.innerText =
            sections[name];
    }


    if (name === "routes") {

        populateRouteTeamSelector();

        loadFinalQR();
    }


    if (
        name === "progress" ||
        name === "results" ||
        name === "event"
    ) {

        loadAdminEventData();
    }
}


/* =========================================================
   TEAM MANAGEMENT
========================================================= */

async function loadTeams() {

    try {

        const response =
            await fetch(
                "/api/admin-teams",
                {
                    cache: "no-store"
                }
            );


        if (
            response.status ===
            401
        ) {

            location.reload();

            return;
        }


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            console.error(
                "LOAD TEAMS ERROR:",
                result.message
            );

            return;
        }


        teams =
            result.teams || [];


        renderTeams();


    } catch (error) {

        console.error(
            "LOAD TEAMS ERROR:",
            error
        );
    }
}


async function createTeam() {

    const teamName =
        document
            .getElementById(
                "teamName"
            )
            .value
            .trim();


    const loginCode =
        document
            .getElementById(
                "loginCode"
            )
            .value
            .trim();


    if (
        !teamName ||
        !loginCode
    ) {

        showTeamMessage(
            "Enter a team name and login code.",
            false
        );


        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin-teams",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            teamName,
                            loginCode
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showTeamMessage(
                result.message ||
                "Could not register team.",
                false
            );


            return;
        }


        document
            .getElementById(
                "teamName"
            )
            .value = "";


        document
            .getElementById(
                "loginCode"
            )
            .value = "";


        showTeamMessage(
            "Team registered successfully.",
            true
        );


        await loadTeams();


    } catch (error) {

        console.error(
            "CREATE TEAM ERROR:",
            error
        );


        showTeamMessage(
            "Could not connect to the server.",
            false
        );
    }
}


async function deleteTeam(
    id,
    name
) {

    const confirmed =
        confirm(
            `Delete ${name}?\n\nThis will also delete this team's route and checkpoint records.`
        );


    if (!confirmed) {

        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin-teams",
                {

                    method: "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            teamId: id
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showTeamMessage(
                result.message ||
                "Could not delete team.",
                false
            );


            return;
        }


        showTeamMessage(
            `${name} deleted.`,
            true
        );


        const routeSelect =
            document.getElementById(
                "routeTeamSelect"
            );


        if (
            routeSelect &&
            Number(routeSelect.value) ===
            Number(id)
        ) {

            routeSelect.value =
                "";


            document
                .getElementById(
                    "routeEditor"
                )
                ?.classList
                .add(
                    "hidden"
                );
        }


        await loadTeams();


    } catch (error) {

        console.error(
            "DELETE TEAM ERROR:",
            error
        );


        showTeamMessage(
            "Could not connect to the server.",
            false
        );
    }
}


async function resetTeamSession(
    id,
    name
) {

    const confirmed =
        confirm(
            `Reset login session for ${name}?\n\nTheir checkpoint progress will NOT be deleted.`
        );


    if (!confirmed) {

        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin-teams",
                {

                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            teamId: id
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showTeamMessage(
                result.message ||
                "Could not reset login session.",
                false
            );


            return;
        }


        showTeamMessage(
            `${name}'s login session has been reset.`,
            true
        );


        await loadTeams();

        await loadAdminEventData();


    } catch (error) {

        console.error(
            "RESET TEAM SESSION ERROR:",
            error
        );


        showTeamMessage(
            "Could not connect to the server.",
            false
        );
    }
}


function renderTeams() {

    const list =
        document.getElementById(
            "teamList"
        );


    if (!list) {

        return;
    }


    list.innerHTML =
        "";


    const teamCount =
        document.getElementById(
            "teamCount"
        );


    const overviewTeams =
        document.getElementById(
            "overviewTeams"
        );


    const overviewFinished =
        document.getElementById(
            "overviewFinished"
        );


    if (teamCount) {

        teamCount.innerText =
            `${teams.length} / 4`;
    }


    if (overviewTeams) {

        overviewTeams.innerText =
            `${teams.length} / 4`;
    }


    const finishedCount =
        teams.filter(
            team =>
                team.finished_at
        ).length;


    if (overviewFinished) {

        overviewFinished.innerText =
            finishedCount;
    }


    if (
        teams.length === 0
    ) {

        list.innerHTML = `

            <p>
                No teams have been registered yet.
            </p>

        `;


        populateRouteTeamSelector();


        return;
    }


    teams.forEach(
        team => {

            const card =
                document.createElement(
                    "div"
                );


            const active =
                team.active_session_token
                    ?
                    "Logged in"
                    :
                    "Not logged in";


            const routeStatus =
                team.route_ready === true
                    ?
                    "Route ready"
                    :
                    team.route_ready === false
                        ?
                        "Route incomplete"
                        :
                        "Route status unavailable";


            card.className =
                "team-item";


            card.innerHTML = `

                <div>

                    <div class="team-name">

                        ${escapeHTML(
                            team.team_name
                        )}

                    </div>


                    <div class="team-details">

                        Current stage:
                        ${escapeHTML(
                            stageDisplayName(
                                team.current_checkpoint
                            )
                        )}

                        &nbsp; • &nbsp;

                        ${active}

                        &nbsp; • &nbsp;

                        ${routeStatus}

                    </div>


                    <div class="team-code">

                        Login Code:
                        ${escapeHTML(
                            team.login_code
                        )}

                    </div>

                </div>


                <div class="team-buttons">

                    <button
                        class="
                            small-button
                            reset-button
                        "

                        onclick="
                            resetTeamSession(
                                ${Number(team.id)},
                                '${escapeJS(
                                    team.team_name
                                )}'
                            )
                        "
                    >

                        Reset Login

                    </button>


                    <button
                        class="
                            small-button
                            delete-button
                        "

                        onclick="
                            deleteTeam(
                                ${Number(team.id)},
                                '${escapeJS(
                                    team.team_name
                                )}'
                            )
                        "
                    >

                        Delete

                    </button>

                </div>

            `;


            list.appendChild(
                card
            );
        }
    );


    populateRouteTeamSelector();
}


function showTeamMessage(
    text,
    success
) {

    const message =
        document.getElementById(
            "teamMessage"
        );


    if (!message) {

        return;
    }


    message.innerText =
        text;


    message.className =
        success
            ?
            "message success"
            :
            "message error";
}


/* =========================================================
   EVENT / LIVE DATA
========================================================= */

async function loadAdminEventData() {

    try {

        const response =
            await fetch(
                "/api/admin-event",
                {
                    cache: "no-store"
                }
            );


        if (
            response.status ===
            401
        ) {

            location.reload();

            return;
        }


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            console.error(
                "ADMIN EVENT ERROR:",
                result.message
            );


            return;
        }


        liveProgressData =
            result;


        renderEventStatus(
            result.event || {},
            result.teams || []
        );


        if (
            Array.isArray(
                result.progress
            )
        ) {

            renderLiveProgress(
                result
            );


            renderResults(
                result
            );
        }


    } catch (error) {

        console.error(
            "ADMIN EVENT ERROR:",
            error
        );
    }
}


function renderEventStatus(
    event,
    eventTeams
) {

    const status =
        document.getElementById(
            "eventStatus"
        );


    const overview =
        document.getElementById(
            "overviewStatus"
        );


    const readyList =
        document.getElementById(
            "readyTeamList"
        );


    const startButton =
        document.getElementById(
            "startEventButton"
        );


    if (
        !status ||
        !overview ||
        !readyList ||
        !startButton
    ) {

        return;
    }


    const eventStatus =
        String(
            event?.status ||
            "waiting"
        ).toUpperCase();


    status.innerText =
        eventStatus;


    overview.innerText =
        eventStatus;


    readyList.innerHTML =
        "";


    if (
        eventTeams.length === 0
    ) {

        readyList.innerHTML = `

            <div class="ready-team">

                <strong>
                    No teams registered
                </strong>

                <span class="not-ready">
                    NOT READY
                </span>

            </div>

        `;
    }


    eventTeams.forEach(
        team => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "ready-team";


            const cameraReady =
                Boolean(
                    team.camera_ready
                );


            const routeKnown =
                typeof team.route_ready ===
                "boolean";


            const routeReady =
                routeKnown
                    ?
                    team.route_ready
                    :
                    true;


            let readinessText =
                "";


            let readinessClass =
                "not-ready";


            if (
                cameraReady &&
                routeReady
            ) {

                readinessText =
                    routeKnown
                        ?
                        "✓ CAMERA + ROUTE READY"
                        :
                        "✓ CAMERA READY";


                readinessClass =
                    "ready";

            } else {

                const missing =
                    [];


                if (!cameraReady) {

                    missing.push(
                        "CAMERA"
                    );
                }


                if (
                    routeKnown &&
                    !routeReady
                ) {

                    missing.push(
                        "ROUTE"
                    );
                }


                readinessText =
                    `WAITING: ${
                        missing.join(
                            " + "
                        )
                    }`;
            }


            item.innerHTML = `

                <strong>

                    ${escapeHTML(
                        team.team_name
                    )}

                </strong>


                <span
                    class="${readinessClass}"
                >

                    ${readinessText}

                </span>

            `;


            readyList.appendChild(
                item
            );
        }
    );


    const routeFieldAvailable =
        eventTeams.some(
            team =>
                typeof team.route_ready ===
                "boolean"
        );


    const everyoneReady =
        eventTeams.length === 4 &&
        eventTeams.every(
            team =>
                team.camera_ready
        ) &&
        (
            !routeFieldAvailable ||
            eventTeams.every(
                team =>
                    team.route_ready
            )
        );


    if (
        eventStatus ===
        "RUNNING"
    ) {

        startButton.disabled =
            true;


        startButton.innerText =
            "EVENT RUNNING";

    } else if (
        eventStatus ===
        "FINISHED"
    ) {

        startButton.disabled =
            true;


        startButton.innerText =
            "EVENT FINISHED";

    } else {

        startButton.disabled =
            !everyoneReady;


        startButton.innerText =
            everyoneReady
                ?
                "⚡ START TREASURE HUNT"
                :
                "Waiting for all teams";
    }
}


async function startEvent() {

    const confirmed =
        confirm(
            "Start the Treasure Hunt now?\n\nAll four teams will begin simultaneously."
        );


    if (!confirmed) {

        return;
    }


    const button =
        document.getElementById(
            "startEventButton"
        );


    const message =
        document.getElementById(
            "eventMessage"
        );


    button.disabled =
        true;


    button.innerText =
        "Starting event...";


    try {

        const response =
            await fetch(
                "/api/admin-event",
                {
                    method: "POST"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            let text =
                result.message ||
                "Could not start the event.";


            if (
                Array.isArray(
                    result.notReady
                ) &&
                result.notReady.length
            ) {

                text +=
                    `\nNot ready: ${
                        result.notReady.join(
                            ", "
                        )
                    }`;
            }


            if (
                Array.isArray(
                    result.teams
                ) &&
                result.teams.length
            ) {

                text +=
                    `\nCheck: ${
                        result.teams.join(
                            ", "
                        )
                    }`;
            }


            message.className =
                "message error";


            message.innerText =
                text;


            await loadAdminEventData();


            return;
        }


        message.className =
            "message success";


        message.innerText =
            "Treasure Hunt started successfully!";


        await loadAdminEventData();


    } catch (error) {

        console.error(
            "START EVENT ERROR:",
            error
        );


        message.className =
            "message error";


        message.innerText =
            "Could not start the event.";


        await loadAdminEventData();
    }
}


async function resetEvent() {

    const confirmed =
        confirm(
            "RESET THE TREASURE HUNT?\n\n" +
            "This will:\n" +
            "• Stop the current event\n" +
            "• Clear checkpoint progress\n" +
            "• Clear finish times\n" +
            "• Log out all teams\n" +
            "• Require camera verification again\n\n" +
            "Registered teams and route configuration will NOT be deleted."
        );


    if (!confirmed) {

        return;
    }


    const secondConfirm =
        confirm(
            "Are you sure?\n\n" +
            "This action resets all current event progress."
        );


    if (!secondConfirm) {

        return;
    }


    const message =
        document.getElementById(
            "eventMessage"
        );


    try {

        const response =
            await fetch(
                "/api/admin-event",
                {
                    method: "PATCH"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.className =
                "message error";


            message.innerText =
                result.message ||
                "Could not reset event.";


            return;
        }


        message.className =
            "message success";


        message.innerText =
            "✓ Event reset successfully. Teams may prepare for a new hunt.";


        await refreshAdminData();


    } catch (error) {

        console.error(
            "RESET EVENT ERROR:",
            error
        );


        message.className =
            "message error";


        message.innerText =
            "Could not connect to the server.";
    }
}


/* =========================================================
   ROUTE TEAM SELECTOR
========================================================= */

function populateRouteTeamSelector() {

    const select =
        document.getElementById(
            "routeTeamSelect"
        );


    if (!select) {

        return;
    }


    const current =
        select.value;


    select.innerHTML = `

        <option value="">
            Select a team...
        </option>

    `;


    teams.forEach(
        team => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                team.id;


            option.innerText =
                team.team_name;


            select.appendChild(
                option
            );
        }
    );


    if (
        current &&
        teams.some(
            team =>
                String(team.id) ===
                String(current)
        )
    ) {

        select.value =
            current;
    }
}


async function loadTeamRoute() {

    const select =
        document.getElementById(
            "routeTeamSelect"
        );


    const editor =
        document.getElementById(
            "routeEditor"
        );


    const teamId =
        Number(
            select?.value
        );


    clueImageUploads =
        {};


    if (!teamId) {

        routeData =
            {};


        editor
            ?.classList
            .add(
                "hidden"
            );


        return;
    }


    try {

        const response =
            await fetch(

                `/api/admin-routes?teamId=${
                    encodeURIComponent(
                        teamId
                    )
                }`,

                {
                    cache: "no-store"
                }

            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.message ||
                "Could not load team route."
            );


            return;
        }


        routeData =
            {};


        (
            result.route ||
            []
        ).forEach(
            row => {

                routeData[
                    row.checkpoint_number
                ] =
                    row;
            }
        );


        renderRouteEditor(
            teamId
        );


        editor
            ?.classList
            .remove(
                "hidden"
            );


    } catch (error) {

        console.error(
            "LOAD ROUTE ERROR:",
            error
        );


        alert(
            "Could not load team route."
        );
    }
}


/* =========================================================
   ROUTE EDITOR
========================================================= */

function renderRouteEditor(
    teamId
) {

    const container =
        document.getElementById(
            "checkpointEditors"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    const stageInfo = {

        1: {

            title:
                "Starting QR",

            icon:
                "🚪",

            description:
                "This QR is hidden in the starting room. The team must first find its own QR.",

            clueTitle:
                "Clue revealed after START QR",

            clueHelp:
                "This clue guides the team to Checkpoint 1.",

            saveText:
                "Save Starting Stage"
        },


        2: {

            title:
                "Checkpoint 1 QR",

            icon:
                "📍",

            description:
                "This QR is found using the clue revealed by the Starting QR.",

            clueTitle:
                "Clue revealed after Checkpoint 1",

            clueHelp:
                "This clue guides the team to Checkpoint 2.",

            saveText:
                "Save Checkpoint 1"
        },


        3: {

            title:
                "Checkpoint 2 QR",

            icon:
                "📍",

            description:
                "This is the team's unique Checkpoint 2 QR.",

            clueTitle:
                "Clue revealed after Checkpoint 2",

            clueHelp:
                "This clue guides the team to Checkpoint 3.",

            saveText:
                "Save Checkpoint 2"
        },


        4: {

            title:
                "Checkpoint 3 QR",

            icon:
                "📍",

            description:
                "This is the team's unique Checkpoint 3 QR.",

            clueTitle:
                "Clue revealed after Checkpoint 3",

            clueHelp:
                "This clue guides the team to Checkpoint 4.",

            saveText:
                "Save Checkpoint 3"
        },


        5: {

            title:
                "Checkpoint 4 QR",

            icon:
                "📍",

            description:
                "This is the final team-specific QR.",

            clueTitle:
                "FINAL clue revealed after Checkpoint 4",

            clueHelp:
                "This clue guides the team to the common Checkpoint 5 / treasure QR.",

            saveText:
                "Save Checkpoint 4"
        }

    };


    for (
        let stage = 1;
        stage <= 5;
        stage++
    ) {

        const info =
            stageInfo[
                stage
            ];


        const saved =
            routeData[
                stage
            ] || {};


        const configured =
            Boolean(
                saved.qr_code &&
                saved.clue
            );


        const hasImage =
            Boolean(
                saved.clue_image_url
            );


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "checkpoint-editor";


        card.innerHTML = `

            <div class="checkpoint-title-row">

                <h3>
                    ${info.icon}
                    ${info.title}
                </h3>


                <span
                    class="
                        checkpoint-status
                        ${configured ? "saved" : ""}
                    "
                >

                    ${
                        configured
                            ?
                            "✓ CONFIGURED"
                            :
                            "NOT SAVED"
                    }

                </span>

            </div>


            <p class="checkpoint-help">
                ${info.description}
            </p>


            <div class="checkpoint-grid">


                <!-- =========================
                     QR SIDE
                ========================== -->

                <div class="qr-config-panel">


                    <div class="config-label">
                        📷 QR physically placed here
                    </div>


                    <div class="config-help">

                        Upload the exact QR image that
                        the team must scan at this stage.

                    </div>


                    <div class="qr-drop-zone">


                        <img
                            id="qrPreview${stage}"
                            class="qr-preview"
                            alt="QR preview"
                        >


                        <input
                            type="file"
                            accept="image/*"
                            class="qr-file-input"
                            onchange="
                                decodeUploadedQR(
                                    event,
                                    ${stage}
                                )
                            "
                        >


                    </div>


                    <div class="decoded-wrapper">


                        <span class="decoded-label">
                            QR VALUE STORED BY SERVER
                        </span>


                        <div
                            id="qrValue${stage}"
                            class="qr-value"
                        >

                            ${
                                saved.qr_code
                                    ?
                                    escapeHTML(
                                        saved.qr_code
                                    )
                                    :
                                    "Upload a QR image"
                            }

                        </div>


                    </div>


                    <input
                        id="qrManual${stage}"

                        class="qr-manual-input"

                        type="text"

                        value="${
                            escapeAttribute(
                                saved.qr_code ||
                                ""
                            )
                        }"

                        placeholder="Decoded QR value"
                    >


                </div>


                <!-- =========================
                     CLUE / IMAGE / HINT /
                     ANSWER SIDE
                ========================== -->

                <div class="clue-config-panel">


                    <!-- CLUE -->

                    <div class="config-label">
                        🧭 ${info.clueTitle}
                    </div>


                    <div class="config-help">
                        ${info.clueHelp}
                    </div>


                    <textarea
                        id="clue${stage}"

                        class="route-textarea"

                        placeholder="Enter the clue that appears after this QR is scanned..."
                    >${
                        escapeHTML(
                            saved.clue ||
                            ""
                        )
                    }</textarea>


                    <!-- OPTIONAL IMAGE -->

                    <div class="clue-image-section">


                        <div class="clue-image-heading">

                            <span>
                                🖼 Optional Clue Image
                            </span>

                            <small>
                                OPTIONAL
                            </small>

                        </div>


                        <p class="clue-image-help">

                            This image appears immediately
                            together with the clue.

                        </p>


                        <img
                            id="existingClueImage${stage}"

                            class="
                                clue-image-preview
                                ${
                                    hasImage
                                        ?
                                        "visible"
                                        :
                                        ""
                                }
                            "

                            ${
                                hasImage
                                    ?
                                    `src="${
                                        escapeAttribute(
                                            saved.clue_image_url
                                        )
                                    }"`
                                    :
                                    ""
                            }

                            alt="Clue image preview"
                        >


                        <label class="clue-image-upload">

                            <span>

                                ${
                                    hasImage
                                        ?
                                        "Replace Image"
                                        :
                                        "+ Choose Image"
                                }

                            </span>


                            <input
                                type="file"

                                accept="
                                    image/png,
                                    image/jpeg,
                                    image/webp
                                "

                                onchange="
                                    handleClueImage(
                                        event,
                                        ${stage}
                                    )
                                "
                            >

                        </label>


                        <label
                            id="removeImageLabel${stage}"

                            class="
                                remove-clue-image
                                ${
                                    hasImage
                                        ?
                                        ""
                                        :
                                        "hidden"
                                }
                            "
                        >

                            <input
                                type="checkbox"
                                id="removeClueImage${stage}"
                            >

                            Remove saved clue image

                        </label>


                    </div>


                    <!-- HINT -->

                    <div
                        class="
                            route-assistance-block
                            hint-config-block
                        "
                    >


                        <div class="config-label">
                            💡 Hint
                        </div>


                        <div class="config-help">

                            The Hint button appears with
                            the clue but remains locked
                            for 5 minutes.

                        </div>


                        <textarea
                            id="hint${stage}"

                            class="
                                route-textarea
                                assistance-textarea
                            "

                            placeholder="Enter the hint for this clue..."
                        >${
                            escapeHTML(
                                saved.hint ||
                                ""
                            )
                        }</textarea>


                        <div class="unlock-rule">

                            🔒 Unlock rule:
                            5 minutes after this clue
                            becomes available.

                        </div>


                    </div>


                    <!-- ANSWER -->

                    <div
                        class="
                            route-assistance-block
                            answer-config-block
                        "
                    >


                        <div class="config-label">
                            🔑 Answer
                        </div>


                        <div class="config-help">

                            After the team opens the Hint,
                            the Answer remains locked for
                            another 10 minutes.

                        </div>


                        <textarea
                            id="answer${stage}"

                            class="
                                route-textarea
                                assistance-textarea
                            "

                            placeholder="Enter the answer / exact location..."
                        >${
                            escapeHTML(
                                saved.answer ||
                                ""
                            )
                        }</textarea>


                        <div
                            class="
                                unlock-rule
                                answer-rule
                            "
                        >

                            🔒 Unlock rule:
                            10 minutes after the team
                            opens the Hint.

                        </div>


                    </div>


                </div>


            </div>


            <button
                class="save-route-button"

                onclick="
                    saveCheckpoint(
                        ${Number(teamId)},
                        ${stage}
                    )
                "
            >

                ${info.saveText}

            </button>

        `;


        container.appendChild(
            card
        );
    }
}


/* =========================================================
   QR IMAGE DECODER
========================================================= */

async function decodeUploadedQR(
    event,
    checkpoint
) {

    const file =
        event.target.files?.[0];


    if (!file) {

        return;
    }


    if (
        typeof jsQR !==
        "function"
    ) {

        alert(
            "QR decoder did not load. Refresh the admin page and try again."
        );


        return;
    }


    const image =
        new Image();


    const preview =
        document.getElementById(
            `qrPreview${checkpoint}`
        );


    const objectUrl =
        URL.createObjectURL(
            file
        );


    if (preview) {

        preview.src =
            objectUrl;


        preview.style.display =
            "block";
    }


    image.onload =
        () => {

            try {

                const canvas =
                    document.createElement(
                        "canvas"
                    );


                const context =
                    canvas.getContext(
                        "2d",
                        {
                            willReadFrequently:
                                true
                        }
                    );


                canvas.width =
                    image.naturalWidth ||
                    image.width;


                canvas.height =
                    image.naturalHeight ||
                    image.height;


                context.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                const imageData =
                    context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );


                const qr =
                    jsQR(
                        imageData.data,
                        canvas.width,
                        canvas.height
                    );


                const valueBox =
                    document.getElementById(
                        `qrValue${checkpoint}`
                    );


                const manualInput =
                    document.getElementById(
                        `qrManual${checkpoint}`
                    );


                if (!qr) {

                    if (valueBox) {

                        valueBox.innerText =
                            "QR could not be detected.";
                    }


                    return;
                }


                if (valueBox) {

                    valueBox.innerText =
                        qr.data;
                }


                if (manualInput) {

                    manualInput.value =
                        qr.data;
                }


            } catch (error) {

                console.error(
                    "QR DECODE ERROR:",
                    error
                );


                alert(
                    "Could not read this QR image. Try a clearer image."
                );


            } finally {

                URL.revokeObjectURL(
                    objectUrl
                );
            }
        };


    image.onerror =
        () => {

            URL.revokeObjectURL(
                objectUrl
            );


            alert(
                "Could not open the selected QR image."
            );
        };


    image.src =
        objectUrl;
}


/* =========================================================
   OPTIONAL CLUE IMAGE
========================================================= */

function handleClueImage(
    event,
    stage
) {

    const file =
        event.target.files?.[0];


    if (!file) {

        return;
    }


    const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp"

    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        alert(
            "Please choose a JPG, PNG or WebP image."
        );


        event.target.value =
            "";


        return;
    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        alert(
            "Please select an image smaller than 5 MB."
        );


        event.target.value =
            "";


        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        eventData => {

            const image =
                new Image();


            image.onload =
                () => {

                    try {

                        const maxDimension =
                            1200;


                        let width =
                            image.naturalWidth ||
                            image.width;


                        let height =
                            image.naturalHeight ||
                            image.height;


                        if (
                            width >
                            maxDimension ||
                            height >
                            maxDimension
                        ) {

                            const ratio =
                                Math.min(

                                    maxDimension /
                                    width,

                                    maxDimension /
                                    height

                                );


                            width =
                                Math.round(
                                    width *
                                    ratio
                                );


                            height =
                                Math.round(
                                    height *
                                    ratio
                                );
                        }


                        const canvas =
                            document.createElement(
                                "canvas"
                            );


                        canvas.width =
                            width;


                        canvas.height =
                            height;


                        const context =
                            canvas.getContext(
                                "2d"
                            );


                        context.drawImage(
                            image,
                            0,
                            0,
                            width,
                            height
                        );


                        const compressed =
                            canvas.toDataURL(
                                "image/jpeg",
                                0.82
                            );


                        clueImageUploads[
                            stage
                        ] = {

                            data:
                                compressed,

                            mime:
                                "image/jpeg"

                        };


                        const preview =
                            document.getElementById(
                                `existingClueImage${stage}`
                            );


                        if (preview) {

                            preview.src =
                                compressed;


                            preview
                                .classList
                                .add(
                                    "visible"
                                );
                        }


                        const label =
                            document.getElementById(
                                `removeImageLabel${stage}`
                            );


                        if (label) {

                            label
                                .classList
                                .remove(
                                    "hidden"
                                );
                        }


                        const removeCheckbox =
                            document.getElementById(
                                `removeClueImage${stage}`
                            );


                        if (
                            removeCheckbox
                        ) {

                            removeCheckbox.checked =
                                false;
                        }


                    } catch (error) {

                        console.error(
                            "CLUE IMAGE PROCESS ERROR:",
                            error
                        );


                        alert(
                            "Could not process this clue image."
                        );
                    }
                };


            image.onerror =
                () => {

                    alert(
                        "Could not open this clue image."
                    );
                };


            image.src =
                eventData.target.result;
        };


    reader.readAsDataURL(
        file
    );
}


/* =========================================================
   SAVE ROUTE STAGE
========================================================= */

async function saveCheckpoint(
    teamId,
    checkpoint
) {

    const qrCode =
        document
            .getElementById(
                `qrManual${checkpoint}`
            )
            ?.value
            .trim() ||
        "";


    const clue =
        document
            .getElementById(
                `clue${checkpoint}`
            )
            ?.value
            .trim() ||
        "";


    const hint =
        document
            .getElementById(
                `hint${checkpoint}`
            )
            ?.value
            .trim() ||
        "";


    const answer =
        document
            .getElementById(
                `answer${checkpoint}`
            )
            ?.value
            .trim() ||
        "";


    const message =
        document.getElementById(
            "routeMessage"
        );


    if (
        !qrCode ||
        !clue
    ) {

        message.className =
            "message error";


        message.innerText =
            "QR code and clue are required.";


        return;
    }


    const imageUpload =
        clueImageUploads[
            checkpoint
        ] ||
        null;


    const removeImage =
        Boolean(

            document
                .getElementById(
                    `removeClueImage${checkpoint}`
                )
                ?.checked

        );


    message.className =
        "message";


    message.innerText =
        "Saving stage...";


    try {

        const response =
            await fetch(
                "/api/admin-routes",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            teamId,

                            checkpointNumber:
                                checkpoint,

                            qrCode,

                            clue,

                            hint,

                            answer,

                            clueImageData:
                                imageUpload
                                    ?
                                    imageUpload.data
                                    :
                                    null,

                            clueImageMime:
                                imageUpload
                                    ?
                                    imageUpload.mime
                                    :
                                    null,

                            removeClueImage:
                                removeImage

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.className =
                "message error";


            message.innerText =
                result.message ||
                "Could not save route stage.";


            return;
        }


        delete clueImageUploads[
            checkpoint
        ];


        message.className =
            "message success";


        message.innerText =
            `✓ ${
                stageSaveLabel(
                    checkpoint
                )
            } saved.`;


        await loadTeamRoute();

        await loadTeams();

        await loadAdminEventData();


    } catch (error) {

        console.error(
            "SAVE ROUTE ERROR:",
            error
        );


        message.className =
            "message error";


        message.innerText =
            "Could not connect to the server.";
    }
}


/* =========================================================
   COMMON FINAL QR
========================================================= */

async function loadFinalQR() {

    try {

        const response =
            await fetch(
                "/api/admin-final",
                {
                    cache: "no-store"
                }
            );


        if (
            response.status ===
            401
        ) {

            return;
        }


        const result =
            await response.json();


        if (!response.ok) {

            return;
        }


        const valueBox =
            document.getElementById(
                "finalQrValue"
            );


        const manualInput =
            document.getElementById(
                "finalQrManual"
            );


        if (
            result.finalQrCode
        ) {

            if (valueBox) {

                valueBox.innerText =
                    result.finalQrCode;
            }


            if (manualInput) {

                manualInput.value =
                    result.finalQrCode;
            }


        } else {

            if (valueBox) {

                valueBox.innerText =
                    "No final QR configured";
            }


            if (manualInput) {

                manualInput.value =
                    "";
            }
        }


    } catch (error) {

        console.error(
            "LOAD FINAL QR ERROR:",
            error
        );
    }
}


function decodeFinalQR(
    event
) {

    const file =
        event.target.files?.[0];


    if (!file) {

        return;
    }


    if (
        typeof jsQR !==
        "function"
    ) {

        alert(
            "QR decoder did not load. Refresh the page and try again."
        );


        return;
    }


    const image =
        new Image();


    const preview =
        document.getElementById(
            "finalQrPreview"
        );


    const objectUrl =
        URL.createObjectURL(
            file
        );


    if (preview) {

        preview.src =
            objectUrl;


        preview.style.display =
            "block";
    }


    image.onload =
        () => {

            try {

                const canvas =
                    document.createElement(
                        "canvas"
                    );


                const context =
                    canvas.getContext(
                        "2d",
                        {
                            willReadFrequently:
                                true
                        }
                    );


                canvas.width =
                    image.naturalWidth ||
                    image.width;


                canvas.height =
                    image.naturalHeight ||
                    image.height;


                context.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                const imageData =
                    context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );


                const qr =
                    jsQR(
                        imageData.data,
                        canvas.width,
                        canvas.height
                    );


                if (!qr) {

                    document
                        .getElementById(
                            "finalQrValue"
                        )
                        .innerText =
                            "QR could not be detected.";


                    return;
                }


                document
                    .getElementById(
                        "finalQrValue"
                    )
                    .innerText =
                        qr.data;


                document
                    .getElementById(
                        "finalQrManual"
                    )
                    .value =
                        qr.data;


            } catch (error) {

                console.error(
                    "FINAL QR DECODE ERROR:",
                    error
                );


                alert(
                    "Could not read this final QR image."
                );


            } finally {

                URL.revokeObjectURL(
                    objectUrl
                );
            }
        };


    image.onerror =
        () => {

            URL.revokeObjectURL(
                objectUrl
            );


            alert(
                "Could not open the selected final QR image."
            );
        };


    image.src =
        objectUrl;
}


async function saveFinalQR() {

    const value =
        document
            .getElementById(
                "finalQrManual"
            )
            ?.value
            .trim() ||
        "";


    const message =
        document.getElementById(
            "finalQrMessage"
        );


    if (!value) {

        message.className =
            "message error";


        message.innerText =
            "Upload or enter the final QR first.";


        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin-final",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            finalQrCode:
                                value
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.className =
                "message error";


            message.innerText =
                result.message ||
                "Could not save final QR.";


            return;
        }


        message.className =
            "message success";


        message.innerText =
            "✓ Common Checkpoint 5 QR saved.";


        document
            .getElementById(
                "finalQrValue"
            )
            .innerText =
                value;


        await loadAdminEventData();


    } catch (error) {

        console.error(
            "SAVE FINAL QR ERROR:",
            error
        );


        message.className =
            "message error";


        message.innerText =
            "Could not connect to the server.";
    }
}


/* =========================================================
   LIVE PROGRESS
========================================================= */

function renderLiveProgress(
    data
) {

    const grid =
        document.getElementById(
            "liveProgressGrid"
        );


    const liveStatus =
        document.getElementById(
            "liveEventStatus"
        );


    if (
        !grid ||
        !liveStatus
    ) {

        return;
    }


    liveStatus.innerText =
        String(
            data.event?.status ||
            "waiting"
        ).toUpperCase();


    grid.innerHTML =
        "";


    if (
        !Array.isArray(
            data.progress
        ) ||
        data.progress.length === 0
    ) {

        grid.innerHTML = `

            <div class="progress-loading">
                No teams registered.
            </div>

        `;


        return;
    }


    data.progress.forEach(
        team => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                team.finishedAt
                    ?
                    "live-team-card finished"
                    :
                    "live-team-card";


            const stageTimes =
                {};


            (
                team.scans ||
                []
            ).forEach(
                scan => {

                    stageTimes[
                        scan.checkpoint_number
                    ] =
                        scan.scanned_at;
                }
            );


            const completedTeamStages =
                (
                    team.scans ||
                    []
                ).length;


            const finalDone =
                Boolean(
                    team.finalScan
                );


            const totalCompleted =
                completedTeamStages +
                (
                    finalDone
                        ?
                        1
                        :
                        0
                );


            const stages = [

                {
                    stage: 1,
                    label: "START",
                    time:
                        stageTimes[1]
                },

                {
                    stage: 2,
                    label: "CP1",
                    time:
                        stageTimes[2]
                },

                {
                    stage: 3,
                    label: "CP2",
                    time:
                        stageTimes[3]
                },

                {
                    stage: 4,
                    label: "CP3",
                    time:
                        stageTimes[4]
                },

                {
                    stage: 5,
                    label: "CP4",
                    time:
                        stageTimes[5]
                },

                {
                    stage: 6,
                    label: "CP5",
                    time:
                        team.finalScan
                            ?
                            team.finalScan
                                .scanned_at
                            :
                            null
                }

            ];


            let routeHTML =
                "";


            stages.forEach(
                stage => {

                    let state =
                        "";


                    if (
                        stage.time
                    ) {

                        state =
                            "complete";


                    } else if (
                        !team.finishedAt &&
                        Number(
                            team.currentStage
                        ) ===
                        Number(
                            stage.stage
                        )
                    ) {

                        state =
                            "current";
                    }


                    const circleContent =
                        stage.time
                            ?
                            "✓"
                            :
                            stage.stage === 6
                                ?
                                "🏁"
                                :
                                stage.stage === 1
                                    ?
                                    "S"
                                    :
                                    stage.stage - 1;


                    routeHTML += `

                        <div
                            class="
                                live-route-stage
                                ${state}
                            "
                        >

                            <div class="stage-circle">
                                ${circleContent}
                            </div>


                            <span class="stage-name">
                                ${stage.label}
                            </span>


                            <span class="stage-time">

                                ${
                                    stage.time
                                        ?
                                        formatClockTime(
                                            stage.time
                                        )
                                        :
                                        "—"
                                }

                            </span>

                        </div>

                    `;
                }
            );


            let finishText =
                "";


            if (
                team.finishedAt &&
                data.event?.started_at
            ) {

                finishText =
                    `Finished in ${
                        formatDuration(
                            data.event.started_at,
                            team.finishedAt
                        )
                    }`;
            }


            card.innerHTML = `

                <div class="live-team-top">


                    <div class="live-team-name">

                        ${escapeHTML(
                            team.name
                        )}

                    </div>


                    <div
                        class="
                            current-stage-badge
                            ${
                                team.finishedAt
                                    ?
                                    "finished"
                                    :
                                    ""
                            }
                        "
                    >

                        ${escapeHTML(
                            team.currentStageLabel ||
                            "START"
                        )}

                    </div>


                </div>


                <div class="live-route">
                    ${routeHTML}
                </div>


                <div class="live-team-footer">


                    <span class="progress-count">

                        ${totalCompleted}
                        / 6 stages completed

                    </span>


                    <span class="finish-time">

                        ${finishText}

                    </span>


                </div>

            `;


            grid.appendChild(
                card
            );
        }
    );
}


function updateLiveTimer() {

    const timer =
        document.getElementById(
            "liveEventTimer"
        );


    if (
        !timer ||
        !liveProgressData
    ) {

        return;
    }


    const event =
        liveProgressData.event ||
        {};


    if (
        event.status !==
        "running" ||
        !event.started_at
    ) {

        timer.innerText =
            "00:00:00";


        return;
    }


    timer.innerText =
        formatDuration(

            event.started_at,

            new Date()
                .toISOString()

        );
}


/* =========================================================
   RESULTS
========================================================= */

function renderResults(
    data
) {

    const podium =
        document.getElementById(
            "podiumArea"
        );


    const table =
        document.getElementById(
            "resultsTable"
        );


    const status =
        document.getElementById(
            "resultsEventStatus"
        );


    if (
        !podium ||
        !table ||
        !status
    ) {

        return;
    }


    status.innerText =
        data.event?.status ===
        "finished"
            ?
            "EVENT FINISHED"
            :
            "EVENT IN PROGRESS";


    const progress =
        Array.isArray(
            data.progress
        )
            ?
            data.progress
            :
            [];


    const finished =
        [
            ...progress
        ]
            .filter(
                team =>
                    team.finishedAt
            )
            .sort(
                (a, b) =>
                    new Date(
                        a.finishedAt
                    ) -
                    new Date(
                        b.finishedAt
                    )
            );


    if (
        finished.length === 0
    ) {

        podium.innerHTML = `

            <div
                class="progress-loading"
                style="
                    grid-column:1/-1;
                "
            >

                No team has reached
                the final treasure yet.

            </div>

        `;


    } else {

        const winner =
            finished[0];


        const runner =
            finished[1];


        podium.innerHTML = `

            <div class="podium-card winner">


                <div class="podium-medal">
                    🥇
                </div>


                <div class="podium-label">
                    WINNER
                </div>


                <div class="podium-name">

                    ${escapeHTML(
                        winner.name
                    )}

                </div>


                <div class="podium-time">

                    ${
                        data.event?.started_at
                            ?
                            formatDuration(

                                data.event.started_at,

                                winner.finishedAt

                            )
                            :
                            formatClockTime(
                                winner.finishedAt
                            )
                    }

                </div>


            </div>


            <div class="podium-card runner">


                <div class="podium-medal">
                    🥈
                </div>


                <div class="podium-label">
                    RUNNER-UP
                </div>


                <div class="podium-name">

                    ${
                        runner
                            ?
                            escapeHTML(
                                runner.name
                            )
                            :
                            "Awaiting team..."
                    }

                </div>


                <div class="podium-time">

                    ${
                        runner
                            ?
                            (
                                data.event?.started_at
                                    ?
                                    formatDuration(

                                        data.event.started_at,

                                        runner.finishedAt

                                    )
                                    :
                                    formatClockTime(
                                        runner.finishedAt
                                    )
                            )
                            :
                            "--:--:--"
                    }

                </div>


            </div>

        `;
    }


    const unfinished =
        progress.filter(
            team =>
                !team.finishedAt
        );


    const ordered = [

        ...finished,

        ...unfinished

    ];


    table.innerHTML =
        "";


    ordered.forEach(
        (
            team,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "result-row";


            if (
                team.finishedAt
            ) {

                row.innerHTML = `

                    <div class="result-position">

                        #${index + 1}

                    </div>


                    <div class="result-team">

                        ${escapeHTML(
                            team.name
                        )}

                    </div>


                    <div class="result-clock">

                        ${
                            formatClockTime(
                                team.finishedAt
                            )
                        }

                    </div>


                    <div class="result-duration">

                        ${
                            data.event?.started_at
                                ?
                                formatDuration(

                                    data.event.started_at,

                                    team.finishedAt

                                )
                                :
                                "—"
                        }

                    </div>

                `;


            } else {

                row.innerHTML = `

                    <div class="result-position">
                        —
                    </div>


                    <div class="result-team">

                        ${escapeHTML(
                            team.name
                        )}

                    </div>


                    <div class="result-waiting">

                        Still hunting

                    </div>


                    <div>
                        —
                    </div>

                `;
            }


            table.appendChild(
                row
            );
        }
    );
}


/* =========================================================
   HELPERS
========================================================= */

function stageDisplayName(
    stage
) {

    switch (
        Number(stage)
    ) {

        case 1:

            return "START";


        case 2:

            return "CP1";


        case 3:

            return "CP2";


        case 4:

            return "CP3";


        case 5:

            return "CP4";


        case 6:

            return "CP5 FINAL";


        default:

            return String(
                stage ??
                "—"
            );
    }
}


function stageSaveLabel(
    stage
) {

    switch (
        Number(stage)
    ) {

        case 1:

            return "Starting stage";


        case 2:

            return "Checkpoint 1";


        case 3:

            return "Checkpoint 2";


        case 4:

            return "Checkpoint 3";


        case 5:

            return "Checkpoint 4";


        default:

            return "Route stage";
    }
}


function formatClockTime(
    timestamp
) {

    if (!timestamp) {

        return "—";
    }


    const date =
        new Date(
            timestamp
        );


    return date
        .toLocaleTimeString(
            [],
            {

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"

            }
        );
}


function formatDuration(
    start,
    end
) {

    const startMs =
        new Date(
            start
        )
            .getTime();


    const endMs =
        new Date(
            end
        )
            .getTime();


    if (
        !Number.isFinite(
            startMs
        ) ||
        !Number.isFinite(
            endMs
        )
    ) {

        return "00:00:00";
    }


    let seconds =
        Math.max(

            0,

            Math.floor(
                (
                    endMs -
                    startMs
                ) /
                1000
            )

        );


    const hours =
        Math.floor(
            seconds /
            3600
        );


    seconds %=
        3600;


    const minutes =
        Math.floor(
            seconds /
            60
        );


    seconds %=
        60;


    return (

        String(
            hours
        )
            .padStart(
                2,
                "0"
            )

        +

        ":"

        +

        String(
            minutes
        )
            .padStart(
                2,
                "0"
            )

        +

        ":"

        +

        String(
            seconds
        )
            .padStart(
                2,
                "0"
            )

    );
}


function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ??
            ""
        );


    return div.innerHTML;
}


function escapeAttribute(
    value
) {

    return escapeHTML(
        value
    )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#39;"
        );
}


function escapeJS(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        )
        .replace(
            /\r/g,
            "\\r"
        )
        .replace(
            /\n/g,
            "\\n"
        );
}