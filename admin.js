let teams = [];


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
    overview:
        "Overview",

    teams:
        "Manage Teams",

    event:
        "Event Control",

    progress:
        "Live Progress",

    results:
        "Results"
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