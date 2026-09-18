let checkingEvent = false;


async function checkEvent() {

    if (checkingEvent) {
        return;
    }

    checkingEvent = true;


    try {

        const response =
            await fetch(
                "/api/team-session",
                {
                    cache: "no-store"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            window.location.href =
                "./login.html";

            return;
        }


        document
            .getElementById(
                "waitingTeamName"
            )
            .innerText =
                result.team.name;


        if (
            result.team.finishedAt
        ) {

            window.location.href =
                "./finished.html";

            return;
        }


        if (
            result.event.status ===
            "running"
        ) {

            document
                .getElementById(
                    "waitingStatus"
                )
                .innerText =
                    "The hunt has begun!";


            window.location.href =
                "./hunt.html";

            return;
        }


        document
            .getElementById(
                "waitingStatus"
            )
            .innerText =
                "Waiting for the administrator to start the hunt...";


    } catch (error) {

        console.error(error);


        document
            .getElementById(
                "waitingMessage"
            )
            .innerText =
                "Connection interrupted. Retrying...";

    } finally {

        checkingEvent =
            false;
    }
}


checkEvent();


setInterval(
    checkEvent,
    2000
);