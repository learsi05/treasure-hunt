let huntCheckRunning = false;


/* ==========================
   CHECK EVENT / TEAM STATUS
========================== */

async function checkHuntStatus() {

    if (huntCheckRunning) {
        return;
    }

    huntCheckRunning = true;


    try {

        const response =
            await fetch(
                "/api/team-session",
                {
                    cache: "no-store"
                }
            );


        // --------------------------------
        // Session disappeared
        // Usually because admin reset event
        // --------------------------------

        if (response.status === 401) {

            showResetMessage(
                "The event has been reset. Returning to team login..."
            );

            setTimeout(
                () => {
                    window.location.replace(
                        "./login.html"
                    );
                },
                1200
            );

            return;
        }


        const result =
            await response.json();


        if (!response.ok) {

            showResetMessage(
                result.message ||
                "Session unavailable."
            );

            return;
        }


        /* Team name */

        document
            .getElementById(
                "huntTeamName"
            )
            .innerText =
                result.team.name;


        /* Already finished */

        if (
            result.team.finishedAt
        ) {

            window.location.replace(
                "./finished.html"
            );

            return;
        }


        /* EVENT RESET / WAITING */

        if (
            result.event.status ===
            "waiting"
        ) {

            showResetMessage(
                "The event has been reset."
            );

            setTimeout(
                () => {

                    window.location.replace(
                        "./waiting.html"
                    );

                },
                1000
            );

            return;
        }


        /* EVENT FINISHED */

        if (
            result.event.status ===
            "finished"
        ) {

            document
                .getElementById(
                    "huntStatus"
                )
                .innerText =
                    "EVENT FINISHED";


            document
                .getElementById(
                    "huntMessage"
                )
                .innerText =
                    "The Treasure Hunt has ended.";

            return;
        }


        /* EVENT RUNNING */

        if (
            result.event.status ===
            "running"
        ) {

            document
                .getElementById(
                    "huntStatus"
                )
                .innerText =
                    "✓ EVENT RUNNING";


            document
                .getElementById(
                    "huntMessage"
                )
                .innerText =
                    `Checkpoint ${result.team.currentCheckpoint} — scanner will appear here.`;
        }


    } catch (error) {

        console.error(
            "HUNT STATUS ERROR:",
            error
        );


        document
            .getElementById(
                "huntMessage"
            )
            .innerText =
                "Connection interrupted. Retrying...";


    } finally {

        huntCheckRunning =
            false;
    }
}


function showResetMessage(text) {

    document
        .getElementById(
            "huntStatus"
        )
        .innerText =
            "EVENT RESET";


    document
        .getElementById(
            "huntMessage"
        )
        .innerText =
            text;
}


/* ==========================
   INITIAL CHECK
========================== */

checkHuntStatus();


/* ==========================
   AUTO REFRESH EVERY 2 SEC
========================== */

setInterval(
    checkHuntStatus,
    2000
);


/* ==========================
   PHONE RETURNS FROM HOME /
   SCREEN LOCK / ANOTHER APP
========================== */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            checkHuntStatus();
        }
    }
);


/* Browser back/forward cache */

window.addEventListener(
    "pageshow",
    () => {

        checkHuntStatus();
    }
);