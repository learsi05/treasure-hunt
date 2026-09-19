let checkingEvent = false;


/* =========================================================
   CHECK EVENT STATE
========================================================= */

async function checkEvent() {

    /*
     * Prevent overlapping requests
     * when setInterval + pageshow +
     * visibilitychange happen together.
     */

    if (checkingEvent) {

        return;
    }


    checkingEvent =
        true;


    try {

        const response =
            await fetch(
                "/api/team-session",
                {
                    cache:
                        "no-store"
                }
            );


        /*
         * Team session was removed,
         * expired, or Admin Reset was used.
         */

        if (
            response.status ===
            401
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


        /*
         * Temporary backend/database error.
         *
         * Do NOT log the participant out.
         * We simply wait and retry.
         */

        if (!response.ok) {

            console.error(
                "WAITING STATE ERROR:",
                result.message
            );


            const message =
                document.getElementById(
                    "waitingMessage"
                );


            if (message) {

                message.innerText =
                    "Connection interrupted. Retrying...";
            }


            return;
        }


        /* =================================================
           TEAM NAME
        ================================================= */

        const teamName =
            document.getElementById(
                "waitingTeamName"
            );


        if (teamName) {

            teamName.innerText =
                result.team?.name ||
                "Your Team";
        }


        /* =================================================
           TEAM ALREADY FINISHED
        ================================================= */

        if (
            result.finished ||
            result.team?.finishedAt
        ) {

            window.location.replace(
                "./finished.html"
            );


            return;
        }


        const eventStatus =
            result.event?.status ||
            "waiting";


        /* =================================================
           EVENT STARTED
        ================================================= */

        if (
            eventStatus ===
            "running"
        ) {

            const status =
                document.getElementById(
                    "waitingStatus"
                );


            if (status) {

                status.innerText =
                    "The hunt has begun!";
            }


            window.location.replace(
                "./hunt.html"
            );


            return;
        }


        /* =================================================
           EVENT FINISHED
        ================================================= */

        if (
            eventStatus ===
            "finished"
        ) {

            /*
             * Normally every team should already
             * have finished before the event reaches
             * this state.
             *
             * This handles an unexpected state safely
             * instead of sending the user back into hunt.
             */

            const status =
                document.getElementById(
                    "waitingStatus"
                );


            if (status) {

                status.innerText =
                    "The event has ended.";
            }


            const message =
                document.getElementById(
                    "waitingMessage"
                );


            if (message) {

                message.innerText =
                    "Please contact the event administrator.";
            }


            return;
        }


        /* =================================================
           EVENT WAITING
        ================================================= */

        const status =
            document.getElementById(
                "waitingStatus"
            );


        if (status) {

            status.innerText =
                "Waiting for the administrator to start the hunt...";
        }


        const message =
            document.getElementById(
                "waitingMessage"
            );


        if (message) {

            message.innerText =
                "Your team is ready. Keep this page open.";
        }


    } catch (error) {

        console.error(
            "WAITING CHECK ERROR:",
            error
        );


        const message =
            document.getElementById(
                "waitingMessage"
            );


        if (message) {

            message.innerText =
                "Connection interrupted. Retrying...";
        }


    } finally {

        checkingEvent =
            false;
    }
}


/* =========================================================
   INITIAL CHECK
========================================================= */

checkEvent();


/* =========================================================
   POLLING
========================================================= */

/*
 * Check every 2 seconds so all teams
 * move into the hunt shortly after
 * Admin presses START.
 */

setInterval(
    checkEvent,
    2000
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

            checkEvent();
        }
    }
);


/* =========================================================
   PAGE RESTORED FROM BROWSER CACHE
========================================================= */

window.addEventListener(
    "pageshow",
    () => {

        checkEvent();
    }
);