let checkingFinishedState = false;


/* =========================================================
   LOAD FINISHED TEAM
========================================================= */

async function loadFinishedTeam() {

    if (checkingFinishedState) {
        return;
    }


    checkingFinishedState = true;


    try {

        const response =
            await fetch(
                "/api/team-session",
                {
                    cache: "no-store"
                }
            );


        /* =================================================
           SESSION RESET / LOGGED OUT
        ================================================= */

        if (
            response.status === 401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        let result;


        try {

            result =
                await response.json();

        } catch (error) {

            throw new Error(
                "Invalid server response."
            );
        }


        /* =================================================
           TEMPORARY SERVER ERROR
        ================================================= */

        if (!response.ok) {

            const connection =
                document.getElementById(
                    "finishConnection"
                );


            if (connection) {

                connection.innerText =
                    "Connection unavailable. Finish is already recorded.";
            }


            return;
        }


        const team =
            result.team || {};


        const event =
            result.event || {};


        const finishedAt =
            team.finishedAt ||
            team.finished_at ||
            null;


        const startedAt =
            event.startedAt ||
            event.started_at ||
            null;


        /* =================================================
           TEAM HAS NOT FINISHED
        ================================================= */

        if (!finishedAt) {

            /*
             * If somehow the user reaches
             * finished.html before finishing,
             * return them to the correct screen.
             */

            if (
                event.status ===
                "running"
            ) {

                window.location.replace(
                    "./hunt.html"
                );


            } else {

                window.location.replace(
                    "./waiting.html"
                );
            }


            return;
        }


        /* =================================================
           TEAM NAME
        ================================================= */

        const nameElement =
            document.getElementById(
                "finishedTeamName"
            );


        if (nameElement) {

            nameElement.innerText =
                team.name ||
                "Your Team";
        }


        /* =================================================
           FINISH CLOCK
        ================================================= */

        const finishClock =
            document.getElementById(
                "finishClock"
            );


        if (finishClock) {

            finishClock.innerText =
                formatClock(
                    finishedAt
                );
        }


        /* =================================================
           TOTAL DURATION
        ================================================= */

        const finishDuration =
            document.getElementById(
                "finishDuration"
            );


        if (
            finishDuration &&
            startedAt
        ) {

            finishDuration.innerText =
                formatDuration(
                    startedAt,
                    finishedAt
                );
        }


        /* =================================================
           CONNECTION MESSAGE
        ================================================= */

        const connection =
            document.getElementById(
                "finishConnection"
            );


        if (connection) {

            connection.innerText =
                "";
        }


    } catch (error) {

        console.error(
            "FINISHED PAGE ERROR:",
            error
        );


        const connection =
            document.getElementById(
                "finishConnection"
            );


        if (connection) {

            connection.innerText =
                "Connection unavailable. Finish is already recorded.";
        }


    } finally {

        checkingFinishedState =
            false;
    }
}


/* =========================================================
   CLOCK FORMAT
========================================================= */

function formatClock(
    timestamp
) {

    const date =
        new Date(
            timestamp
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--:--:--";
    }


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


/* =========================================================
   DURATION FORMAT
========================================================= */

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

        return "--:--:--";
    }


    let seconds =
        Math.max(
            0,
            Math.floor(
                (
                    endMs -
                    startMs
                )
                /
                1000
            )
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


    seconds %=
        3600;


    const minutes =
        Math.floor(
            seconds / 60
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


/* =========================================================
   INITIAL LOAD
========================================================= */

loadFinishedTeam();


/* =========================================================
   KEEP PAGE SYNCHRONIZED
========================================================= */

setInterval(
    loadFinishedTeam,
    5000
);


/* =========================================================
   PHONE RETURNS FROM BACKGROUND
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            loadFinishedTeam();
        }
    }
);


/* =========================================================
   PAGE RESTORED FROM BROWSER CACHE
========================================================= */

window.addEventListener(
    "pageshow",
    () => {

        loadFinishedTeam();
    }
);