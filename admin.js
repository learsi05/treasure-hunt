let adminPassword = "";

async function unlockAdmin() {

    adminPassword =
        document.getElementById("adminPassword").value.trim();

    const message =
        document.getElementById("loginMessage");

    if (!adminPassword) {
        message.innerText = "Enter admin password.";
        return;
    }

    try {

        const response = await fetch("/api/admin-teams", {
            method: "GET",

            headers: {
                "x-admin-password": adminPassword
            }
        });

        const result = await response.json();

        if (!response.ok) {
            message.innerText = result.message;
            return;
        }

        message.innerText = "Admin access granted ✓";

        document.getElementById(
            "adminPanel"
        ).style.display = "block";

        displayTeams(result.teams);

    } catch (error) {

        console.error(error);

        message.innerText =
            "Could not connect to server.";
    }
}

async function createTeam() {

    const teamName =
        document.getElementById("teamName").value.trim();

    const loginCode =
        document.getElementById("loginCode").value.trim();

    const message =
        document.getElementById("message");

    if (!teamName || !loginCode) {
        message.innerText =
            "Enter team name and login code.";
        return;
    }

    try {

        const response = await fetch("/api/admin-teams", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-admin-password": adminPassword
            },

            body: JSON.stringify({
                teamName,
                loginCode
            })
        });

        const result = await response.json();

        if (!response.ok) {
            message.innerText = result.message;
            return;
        }

        message.innerText =
            "✓ Team registered successfully";

        document.getElementById("teamName").value = "";
        document.getElementById("loginCode").value = "";

        await loadTeams();

    } catch (error) {

        console.error(error);

        message.innerText =
            "Server connection failed.";
    }
}

async function loadTeams() {

    const response = await fetch("/api/admin-teams", {

        method: "GET",

        headers: {
            "x-admin-password": adminPassword
        }
    });

    const result = await response.json();

    if (result.success) {
        displayTeams(result.teams);
    }
}

function displayTeams(teams) {

    const teamList =
        document.getElementById("teamList");

    const teamCount =
        document.getElementById("teamCount");

    teamList.innerHTML = "";

    teamCount.innerText =
        `${teams.length} / 4 Teams`;

    teams.forEach(team => {

        const card =
            document.createElement("div");

        card.className = "team-card";

        card.innerHTML = `
            <div>
                <div class="team-name">
                    ${escapeHTML(team.team_name)}
                </div>

                <small>
                    Checkpoint:
                    ${team.current_checkpoint}
                </small>
            </div>

            <div class="team-code">
                ${escapeHTML(team.login_code)}
            </div>
        `;

        teamList.appendChild(card);
    });
}

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}