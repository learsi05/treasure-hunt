let teams = [];
let adminRefreshTimer = null;
let routeData = {};
/* ============================
   PAGE STARTUP
============================ */

window.addEventListener(
    "DOMContentLoaded",
    checkAdminSession
);


async function checkAdminSession() {

    try {

        const response =
            await fetch(
                "/api/admin-session"
            );


        if (response.ok) {

            showDashboard();

            await loadTeams();

        }

    } catch (error) {

        console.error(error);
    }
}


/* ============================
   ADMIN LOGIN
============================ */

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

        message.innerText =
            "Enter the administrator password.";

        message.className =
            "message error";

        return;
    }


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

        message.innerText =
            result.message;

        message.className =
            "message error";

        return;
    }


    showDashboard();

    await loadTeams();
}


function showDashboard() {

    document
        .getElementById("loginScreen")
        .classList
        .add("hidden");

    document
        .getElementById("dashboard")
        .classList
        .remove("hidden");


    // Load immediately
    refreshAdminData();


    // Refresh automatically every 2 seconds
    if (!adminRefreshTimer) {

        adminRefreshTimer = setInterval(
            refreshAdminData,
            2000
        );
    }
}


async function refreshAdminData() {

    await Promise.all([
        loadTeams(),
        loadEventStatus()
    ]);
}


/* ============================
   LOGOUT
============================ */

async function adminLogout() {

    await fetch(
        "/api/admin-logout",
        {
            method: "POST"
        }
    );


    location.reload();
}


/* ============================
   NAVIGATION
============================ */

const sections = {
    overview: "Overview",
    teams: "Manage Teams",
    routes: "Route & QR Setup",
    event: "Event Control",
    progress: "Live Progress",
    results: "Results"
};


function openSection(name) {

    const buttons =
        document
            .querySelectorAll(
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
            section =>
                section
                    .classList
                    .add("hidden")
        );


    document
        .getElementById(
            `${name}Section`
        )
        .classList
        .remove("hidden");


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            nav =>
                nav
                    .classList
                    .remove("active")
        );


    if (button) {

        button
            .classList
            .add("active");
    }


    document
        .getElementById(
            "pageTitle"
        )
        .innerText =
            sections[name];
}


/* ============================
   LOAD TEAMS
============================ */

async function loadTeams() {

    const response =
        await fetch(
            "/api/admin-teams"
        );


    if (
        response.status === 401
    ) {

        location.reload();

        return;
    }


    const result =
        await response.json();


    if (!result.success) {

        return;
    }


    teams =
        result.teams;


    renderTeams();
   
}


/* ============================
   CREATE TEAM
============================ */

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


    const message =
        document
            .getElementById(
                "teamMessage"
            );


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
            result.message,
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
}


/* ============================
   DELETE TEAM
============================ */

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
            result.message,
            false
        );

        return;
    }


    showTeamMessage(
        `${name} deleted.`,
        true
    );


    await loadTeams();
}


/* ============================
   RESET SESSION
============================ */

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
            result.message,
            false
        );

        return;
    }


    showTeamMessage(
        `${name}'s login session has been reset.`,
        true
    );


    await loadTeams();
}


/* ============================
   DISPLAY TEAMS
============================ */

function renderTeams() {

    const list =
        document
            .getElementById(
                "teamList"
            );


    list.innerHTML = "";


    document
        .getElementById(
            "teamCount"
        )
        .innerText =
            `${teams.length} / 4`;


    document
        .getElementById(
            "overviewTeams"
        )
        .innerText =
            `${teams.length} / 4`;


    const finished =
        teams.filter(
            team =>
                team.finished_at
        ).length;


    document
        .getElementById(
            "overviewFinished"
        )
        .innerText =
            finished;


    if (
        teams.length === 0
    ) {

        list.innerHTML =
            `
            <p>
                No teams have been registered yet.
            </p>
            `;

        return;
    }


    teams.forEach(
        team => {

            const card =
                document
                    .createElement(
                        "div"
                    );


            const active =
                team
                    .active_session_token
                    ?
                    "Logged in"
                    :
                    "Not logged in";


            card.className =
                "team-item";


            card.innerHTML =
                `

                <div>

                    <div class="team-name">
                        ${escapeHTML(
                            team.team_name
                        )}
                    </div>

                    <div class="team-details">

                        Current checkpoint:
                        ${team.current_checkpoint}

                        &nbsp; • &nbsp;

                        ${active}

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
                                ${team.id},
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
                                ${team.id},
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
        document
            .getElementById(
                "teamMessage"
            );


    message.innerText =
        text;


    message.className =
        success
            ?
            "message success"
            :
            "message error";
}


function escapeHTML(value) {

    const div =
        document
            .createElement(
                "div"
            );


    div.textContent =
        value;


    return div.innerHTML;
}


function escapeJS(value) {

    return String(value)
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}
async function loadEventStatus() {

    try {

        const response =
            await fetch(
                "/api/admin-event"
            );

        if (response.status === 401) {

            location.reload();

            return;
        }

        const result =
            await response.json();

        if (!result.success) {
            return;
        }

        renderEventStatus(
            result.event,
            result.teams
        );

    } catch (error) {

        console.error(
            "EVENT STATUS ERROR:",
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


    const eventStatus =
        (
            event?.status ||
            "waiting"
        ).toUpperCase();


    status.innerText =
        eventStatus;

    overview.innerText =
        eventStatus;


    readyList.innerHTML = "";


    eventTeams.forEach(team => {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "ready-team";


        item.innerHTML = `

            <strong>
                ${escapeHTML(
                    team.team_name
                )}
            </strong>

            <span class="${
                team.camera_ready
                    ? "ready"
                    : "not-ready"
            }">

                ${
                    team.camera_ready
                        ? "✓ READY"
                        : "NOT READY"
                }

            </span>

        `;


        readyList.appendChild(
            item
        );
    });


    const everyoneReady =
        eventTeams.length === 4 &&
        eventTeams.every(
            team =>
                team.camera_ready
        );


    if (
        eventStatus === "RUNNING"
    ) {

        startButton.disabled =
            true;

        startButton.innerText =
            "EVENT RUNNING";

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


    button.disabled = true;

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

            message.className =
                "message error";

            let text =
                result.message;


            if (
                result.notReady &&
                result.notReady.length
            ) {

                text +=
                    "\nNot ready: " +
                    result.notReady.join(", ");
            }


            message.innerText =
                text;


            await loadEventStatus();

            return;
        }


        message.className =
            "message success";

        message.innerText =
            "Treasure Hunt started successfully!";


        await loadEventStatus();


    } catch (error) {

        console.error(error);

        message.className =
            "message error";

        message.innerText =
            "Could not start the event.";

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

            "Registered teams will NOT be deleted."
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

        console.error(error);

        message.className =
            "message error";

        message.innerText =
            "Could not connect to server.";
    }
}
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


    select.innerHTML =
        `
        <option value="">
            Select a team
        </option>
        `;


    teams.forEach(team => {

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
    });


    if (current) {
        select.value = current;
    }
}
async function loadTeamRoute() {

    const teamId =
        Number(
            document
                .getElementById(
                    "routeTeamSelect"
                )
                .value
        );


    const editor =
        document.getElementById(
            "routeEditor"
        );


    if (!teamId) {

        editor.classList.add(
            "hidden"
        );

        return;
    }


    const response =
        await fetch(
            `/api/admin-routes?teamId=${teamId}`,
            {
                cache: "no-store"
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        alert(
            result.message
        );

        return;
    }


    routeData = {};


    result.route.forEach(row => {

        routeData[
            row.checkpoint_number
        ] = row;
    });


    renderRouteEditor(
        teamId
    );


    editor.classList.remove(
        "hidden"
    );
}
function renderRouteEditor(teamId) {

    const container =
        document.getElementById(
            "checkpointEditors"
        );

    container.innerHTML = "";


    for (
        let cp = 1;
        cp <= 5;
        cp++
    ) {

        const saved =
            routeData[cp] || {};


        const configured =
            Boolean(
                saved.qr_code &&
                saved.clue
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
                    Checkpoint ${cp}
                </h3>

                <span
                    class="
                        checkpoint-status
                        ${configured ? "saved" : ""}
                    "
                >

                    ${
                        configured
                            ? "✓ CONFIGURED"
                            : "NOT SAVED"
                    }

                </span>

            </div>


            <p class="checkpoint-help">

                The clue below leads this team to
                this checkpoint. The QR uploaded here
                is the only QR accepted at this stage.

            </p>


            <div class="checkpoint-grid">


                <!-- QR -->

                <div class="qr-config-panel">

                    <div class="config-label">
                        📷 Assigned QR Code
                    </div>

                    <div class="config-help">
                        Upload the exact QR that will
                        physically be placed at this location.
                    </div>


                    <div class="qr-drop-zone">

                        <img
                            id="qrPreview${cp}"
                            class="qr-preview"
                        >


                        <input
                            type="file"
                            accept="image/*"
                            class="qr-file-input"

                            onchange="
                                decodeUploadedQR(
                                    event,
                                    ${cp}
                                )
                            "
                        >

                    </div>


                    <div class="decoded-wrapper">

                        <span class="decoded-label">
                            Decoded QR Value
                        </span>

                        <div
                            id="qrValue${cp}"
                            class="qr-value"
                        >

                            ${
                                saved.qr_code
                                    ?
                                    escapeHTML(
                                        saved.qr_code
                                    )
                                    :
                                    "Upload a QR to decode it"
                            }

                        </div>

                    </div>


                    <input
                        id="qrManual${cp}"
                        class="qr-manual-input"

                        type="text"

                        value="${
                            saved.qr_code
                                ?
                                escapeHTML(
                                    saved.qr_code
                                )
                                :
                                ""
                        }"

                        placeholder="
                            QR value appears here
                        "
                    >

                </div>


                <!-- CLUE -->

                <div class="clue-config-panel">

                    <div class="config-label">
                        🧭 Clue Shown to Team
                    </div>

                    <div class="config-help">

                        This clue is shown BEFORE
                        Checkpoint ${cp} is scanned.

                        It should guide the team toward
                        the location of this QR.

                    </div>


                    <textarea
                        id="clue${cp}"
                        class="route-textarea"

                        placeholder="Example: Where money sleeps behind glass, seek your next mark..."
                    >${
                        saved.clue
                            ?
                            escapeHTML(
                                saved.clue
                            )
                            :
                            ""
                    }</textarea>

                </div>


            </div>


            <button
                class="save-route-button"

                onclick="
                    saveCheckpoint(
                        ${teamId},
                        ${cp}
                    )
                "
            >

                Save Checkpoint ${cp}

            </button>

        `;


        container.appendChild(
            card
        );
    }
}
async function decodeUploadedQR(
    event,
    checkpoint
) {

    const file =
        event.target.files[0];


    if (!file) {
        return;
    }


    const image =
        new Image();


    const preview =
        document.getElementById(
            `qrPreview${checkpoint}`
        );


    const url =
        URL.createObjectURL(
            file
        );


    preview.src = url;

    preview.style.display =
        "block";


    image.onload = () => {

        const canvas =
            document.createElement(
                "canvas"
            );


        const context =
            canvas.getContext(
                "2d"
            );


        canvas.width =
            image.width;

        canvas.height =
            image.height;


        context.drawImage(
            image,
            0,
            0
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
                    `qrValue${checkpoint}`
                )
                .innerText =
                    "QR could not be detected.";


            return;
        }


        const value =
            qr.data;


        document
            .getElementById(
                `qrValue${checkpoint}`
            )
            .innerText =
                value;


        document
            .getElementById(
                `qrManual${checkpoint}`
            )
            .value =
                value;
    };


    image.src = url;
}
async function saveCheckpoint(
    teamId,
    checkpoint
) {

    const qrCode =
        document
            .getElementById(
                `qrManual${checkpoint}`
            )
            .value
            .trim();


    const clue =
        document
            .getElementById(
                `clue${checkpoint}`
            )
            .value
            .trim();


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
            `Checkpoint ${checkpoint}: QR and clue are required.`;

        return;
    }


    const response =
        await fetch(
            "/api/admin-routes",
            {

                method: "POST",

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

                        clue

                    })

            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        message.className =
            "message error";

        message.innerText =
            result.message;

        return;
    }


    message.className =
        "message success";

    message.innerText =
        `✓ Checkpoint ${checkpoint} saved.`;


    await loadTeamRoute();
}